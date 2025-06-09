import container from "../src/node"

const socket = container.server("websocket", {
	port: 8081
})

const client = container.client("websocket", {
	baseURL: `ws://localhost:${socket.port}`
})

async function main() {
	await socket.start()
	console.log("Server started on port", socket.port)

	await client.connect()

	console.log("Client connected")

}

main()