"""AWS Lambda handler entry point for NexusOPS BFF."""
import logging
from bff.app import app
from mangum import Mangum

# Create handler
handler = Mangum(app, lifespan="off")
