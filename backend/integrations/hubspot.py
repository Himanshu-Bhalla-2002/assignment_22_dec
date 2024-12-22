# hubspot.py

import json
import secrets
from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse
import httpx
import asyncio
import base64
import requests
from integrations.integration_item import IntegrationItem

from redis_client import add_key_value_redis, get_value_redis, delete_key_redis

CLIENT_ID = '1a5eea8b-72a6-4298-907d-1e0656a4783c'
CLIENT_SECRET = '3d2441e5-0545-4d75-9fe4-5d72a55145f6'
REDIRECT_URI = 'http://localhost:8000/integrations/hubspot/oauth2callback'
SCOPE = (
    'crm.objects.contacts.read '
    'oauth'
)

authorization_url = (
    f'https://app.hubspot.com/oauth/authorize'
    f'?client_id={CLIENT_ID}'
    f'&redirect_uri={REDIRECT_URI}'
    f'&scope={SCOPE}'
)

async def authorize_hubspot(user_id, org_id):
    state_data = {
        'state': secrets.token_urlsafe(32),
        'user_id': user_id,
        'org_id': org_id
    }
    encoded_state = base64.urlsafe_b64encode(json.dumps(state_data).encode('utf-8')).decode('utf-8')
    
    auth_url = f'{authorization_url}&state={encoded_state}'
    await add_key_value_redis(f'hubspot_state:{org_id}:{user_id}', json.dumps(state_data), expire=600)
    
    return auth_url

async def oauth2callback_hubspot(request: Request):
    if request.query_params.get('error'):
        raise HTTPException(status_code=400, detail=request.query_params.get('error'))
    
    code = request.query_params.get('code')
    encoded_state = request.query_params.get('state')
    state_data = json.loads(base64.urlsafe_b64decode(encoded_state).decode('utf-8'))
    
    original_state = state_data.get('state')
    user_id = state_data.get('user_id')
    org_id = state_data.get('org_id')
    
    saved_state = await get_value_redis(f'hubspot_state:{org_id}:{user_id}')
    
    if not saved_state or original_state != json.loads(saved_state).get('state'):
        raise HTTPException(status_code=400, detail='State does not match.')
    
    async with httpx.AsyncClient() as client:
        response, _ = await asyncio.gather(
            client.post(
                'https://api.hubapi.com/oauth/v1/token',
                data={
                    'grant_type': 'authorization_code',
                    'client_id': CLIENT_ID,
                    'client_secret': CLIENT_SECRET,
                    'redirect_uri': REDIRECT_URI,
                    'code': code
                }
            ),
            delete_key_redis(f'hubspot_state:{org_id}:{user_id}')
        )
    
    await add_key_value_redis(f'hubspot_credentials:{org_id}:{user_id}', json.dumps(response.json()), expire=600)
    
    close_window_script = """
    <html>
        <script>
            window.close();
        </script>
    </html>
    """
    return HTMLResponse(content=close_window_script)

async def get_hubspot_credentials(user_id, org_id):
    credentials = await get_value_redis(f'hubspot_credentials:{org_id}:{user_id}')
    if not credentials:
        raise HTTPException(status_code=400, detail='No credentials found.')
    credentials = json.loads(credentials)
    await delete_key_redis(f'hubspot_credentials:{org_id}:{user_id}')
    
    return credentials

def create_integration_item_metadata_object(
    response_json: dict, item_type: str
) -> IntegrationItem:
    return IntegrationItem(
        id=str(response_json.get('id', '')),
        name=response_json.get('properties', {}).get('firstname', '') + ' ' + 
             response_json.get('properties', {}).get('lastname', ''),
        type=item_type,
        creation_time=response_json.get('createdAt'),
        last_modified_time=response_json.get('updatedAt'),
    )

async def get_items_hubspot(credentials) -> list[IntegrationItem]:
    credentials = json.loads(credentials)
    access_token = credentials.get('access_token')
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    # Get contacts
    response = requests.get(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        headers=headers
    )
    
    if response.status_code == 200:
        results = response.json().get('results', [])
        list_of_integration_item_metadata = []
        
        for result in results:
            list_of_integration_item_metadata.append(
                create_integration_item_metadata_object(result, 'Contact')
            )
        
        print(f'list_of_integration_item_metadata: {list_of_integration_item_metadata}')
        return list_of_integration_item_metadata
    
    return []