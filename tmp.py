import os
import asyncio
import logging
from websockets.server import serve

logging.basicConfig(
    format="%(asctime)s %(message)s",
    level=logging.DEBUG,
)

async def echo(websocket):
    async for message in websocket:
        print(message)
        await websocket.send(message)

async def health_check(path, request_headers):
    if path == '/health':
        return http.HTTPStatus.OK, [], b'OK\n'

async def main():
    port = int(os.getenv('PORT'))

    async with serve(
        echo,
        host='0.0.0.0',
        port=port,
        process_request=health_check,
        ping_interval=None,
    ):
        print('Websocket server listening on port', port)

        await asyncio.Future() # run forever

asyncio.run(main())
