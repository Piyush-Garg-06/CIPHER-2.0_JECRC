import asyncio
import json
from typing import Dict, List, Any

class StreamManager:
    """
    Feature 7: Real-Time Telemetry Streaming & SSE Ingestion
    Maintains subscriber queues and broadcasts wearable packets.
    """
    def __init__(self):
        self.subscribers: Dict[str, List[asyncio.Queue]] = {}

    def subscribe(self, patient_id: str) -> asyncio.Queue:
        queue = asyncio.Queue()
        if patient_id not in self.subscribers:
            self.subscribers[patient_id] = []
        self.subscribers[patient_id].append(queue)
        return queue

    def unsubscribe(self, patient_id: str, queue: asyncio.Queue):
        if patient_id in self.subscribers:
            if queue in self.subscribers[patient_id]:
                self.subscribers[patient_id].remove(queue)
            if not self.subscribers[patient_id]:
                del self.subscribers[patient_id]

    async def broadcast_packet(self, patient_id: str, packet: Dict[str, Any]):
        if patient_id in self.subscribers:
            for queue in self.subscribers[patient_id]:
                await queue.put(packet)

stream_manager = StreamManager()
