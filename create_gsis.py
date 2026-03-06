import boto3
import time
from bff import config

def create_gsis():
    dynamodb = boto3.client('dynamodb', region_name=config.AWS_REGION)
    table_name = config.DYNAMODB_TABLE_EXECUTION_RECORDS
    
    print(f"Updating table {table_name} with missing GSIs...")
    
    # 1. Add UserRepoIndex
    # 2. Add UserStatusIndex
    # 3. Rename GSI1 to ExecutionIdIndex (Delete and Recreate)
    
    try:
        # We can only do one GSI creation at a time or use multiple update-table calls?
        # Actually update-table allows multiple GSI updates in one call normally, 
        # but DynamoDB limits it to one CREATE per call.
        
        gsi_updates = [
            {
                'Create': {
                    'IndexName': 'UserRepoIndex',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'repo_id', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            },
            {
                'Create': {
                    'IndexName': 'UserStatusIndex',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'status', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            }
        ]
        
        # Check if attribute definitions exist
        table_desc = dynamodb.describe_table(TableName=table_name)
        attr_defs = table_desc['Table']['AttributeDefinitions']
        attr_names = [a['AttributeName'] for a in attr_defs]
        
        required_attrs = [
            {'AttributeName': 'repo_id', 'AttributeType': 'S'},
            {'AttributeName': 'status', 'AttributeType': 'S'}
        ]
        
        new_attr_defs = list(attr_defs)
        for req in required_attrs:
            if req['AttributeName'] not in attr_names:
                new_attr_defs.append(req)
        
        print("Applying GSI updates (this may take time)...")
        # Note: You can't add multiple GSIs in a single update-table call if they are new?
        # "Each UpdateTable request can include at most one GlobalSecondaryIndex creation."
        
        for update in gsi_updates:
            index_name = update['Create']['IndexName']
            print(f"Creating index: {index_name}")
            try:
                response = dynamodb.update_table(
                    TableName=table_name,
                    AttributeDefinitions=new_attr_defs,
                    GlobalSecondaryIndexUpdates=[update]
                )
                print(f"Update triggered for {index_name}. Waiting for ACTIVE status...")
                
                # Wait for GSI to be active before starting next
                while True:
                    desc = dynamodb.describe_table(TableName=table_name)
                    gsis = desc['Table'].get('GlobalSecondaryIndexes', [])
                    gsi = next((g for g in gsis if g['IndexName'] == index_name), None)
                    if gsi and gsi['IndexStatus'] == 'ACTIVE':
                        print(f"Index {index_name} is now ACTIVE.")
                        break
                    elif gsi:
                        print(f"Status: {gsi['IndexStatus']}...")
                    time.sleep(10)
            except dynamodb.exceptions.ResourceInUseException:
                print(f"Index {index_name} already exists or table is being updated.")
            except Exception as e:
                print(f"Error creating {index_name}: {e}")

    except Exception as e:
        print(f"Fatal Error: {e}")

if __name__ == "__main__":
    create_gsis()
