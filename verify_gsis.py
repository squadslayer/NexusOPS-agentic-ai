import boto3
from bff import config

def verify_gsis():
    dynamodb = boto3.client('dynamodb', region_name=config.AWS_REGION)
    table_name = config.DYNAMODB_TABLE_EXECUTION_RECORDS
    
    print(f"Verifying GSIs for table: {table_name}")
    try:
        response = dynamodb.describe_table(TableName=table_name)
        gsis = response['Table'].get('GlobalSecondaryIndexes', [])
        
        gsi_names = [gsi['IndexName'] for gsi in gsis]
        print(f"Found GSIs: {gsi_names}")
        
        required_gsis = ['UserRepoIndex', 'UserStatusIndex']
        for required in required_gsis:
            if required in gsi_names:
                status = next(gsi['IndexStatus'] for gsi in gsis if gsi['IndexName'] == required)
                print(f"GSI {required}: {status}")
            else:
                print(f"MISSING GSI: {required}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_gsis()
