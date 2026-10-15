"""
api_conversation_bot.py

Endpoint conversacional tipo chat: el cliente manda el historial COMPLETO
de mensajes en cada petición (igual que la API de OpenAI/Claude), y el
servidor no guarda estado — solo reenvía ese historial a Ollama y regresa
la respuesta. La "memoria" de la conversación vive del lado del cliente,
no del servidor.

Requiere que Ollama ya esté corriendo como servicio persistente en el
mismo servidor (localhost:11434), no se prende/apaga por petición —
a diferencia del reporte semanal, aquí SÍ necesita estar siempre listo
para dar respuestas rápidas tipo chat.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Literal, Optional
import ollama
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("conversation_bot")

app = FastAPI(title="API Conversation Bot")

MODELO_IA = "qwen2.5:3b"  # modelo ligero, pensado para correr persistente con RAM limitada


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ConversationRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = None  # permite sobreescribir el modelo por petición si hace falta


class ConversationResponse(BaseModel):
    role: str
    content: str


@app.post("/apiConversationBot", response_model=ConversationResponse)
def conversation_bot(request: ConversationRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="El campo 'messages' no puede estar vacío.")

    modelo = request.model or MODELO_IA
    mensajes = [m.dict() for m in request.messages]

    logger.info(f"[REQUEST] modelo={modelo} | {len(mensajes)} mensajes en el historial")

    try:
        response = ollama.chat(model=modelo, messages=mensajes)
    except Exception as e:
        logger.error(f"[ERROR] Falló la llamada a Ollama: {e}")
        raise HTTPException(status_code=502, detail=f"Error al generar respuesta: {e}")

    contenido = response["message"]["content"]
    logger.info(f"[RESPONSE] {contenido[:100]}...")

    return ConversationResponse(role="assistant", content=contenido)


@app.get("/health")
def health_check():
    """Endpoint simple para confirmar que la API está viva (útil para monitoreo)."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    # host 127.0.0.1: solo accesible desde el propio servidor —
    # nginx es quien expone esto al exterior, no la API directamente.
    uvicorn.run(app, host="127.0.0.1", port=8010)