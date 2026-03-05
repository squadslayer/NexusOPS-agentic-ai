from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws")

# Simple in-memory connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, execution_id: str):
        await websocket.accept()
        if execution_id not in self.active_connections:
            self.active_connections[execution_id] = []
        self.active_connections[execution_id].append(websocket)
        logger.info(f"WebSocket connected for execution {execution_id}. Total: {len(self.active_connections[execution_id])}")

    def disconnect(self, websocket: WebSocket, execution_id: str):
        if execution_id in self.active_connections:
            self.active_connections[execution_id].remove(websocket)
            if not self.active_connections[execution_id]:
                del self.active_connections[execution_id]
        logger.info(f"WebSocket disconnected for execution {execution_id}")

    async def broadcast(self, execution_id: str, message: dict):
        if execution_id in self.active_connections:
            for connection in self.active_connections[execution_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/executions/{execution_id}")
async def websocket_endpoint(websocket: WebSocket, execution_id: str):
    await manager.connect(websocket, execution_id)
    try:
        while True:
            # We don't expect messages from client for now, just keep connection open
            data = await websocket.receive_text()
            # If we wanted to handle incoming commands, we would do it here
    except WebSocketDisconnect:
        manager.disconnect(websocket, execution_id)
    except Exception as e:
        logger.error(f"WebSocket error for {execution_id}: {str(e)}")
        manager.disconnect(websocket, execution_id)

@router.post("/notify")
async def notify_from_orchestrator(request: Request):
    """
    POST /ws/notify
    Internal endpoint for the orchestrator to push updates.
    """
    try:
        data = await request.json()
        execution_id = data.get("execution_id")
        stage = data.get("stage")
        status = data.get("status")
        
        if not execution_id:
            return {"success": False, "error": "execution_id missing"}
            
        await manager.broadcast(execution_id, {
            "execution_id": execution_id,
            "stage": stage,
            "status": status,
            "timestamp": data.get("timestamp", "2026-03-04T12:33:21Z")
        })
        return {"success": True}
    except Exception as e:
        logger.error(f"Error in notify_from_orchestrator: {str(e)}")
        return {"success": False, "error": str(e)}

# Helper function to push updates from the orchestrator (internal)
async def notify_execution_update(execution_id: str, stage: str, status: str):
    message = {
        "execution_id": execution_id,
        "stage": stage,
        "status": status,
        "timestamp": "2026-03-04T12:33:21Z" # Replace with real timestamp logic
    }
    await manager.broadcast(execution_id, message)
