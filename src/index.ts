import HttpServer from './HttpServer'
import PrintServer from './PrintServer'

const server = new PrintServer()
server
  .start()
  .then(() => {
    new HttpServer(server)
  })
  .catch(console.error)
