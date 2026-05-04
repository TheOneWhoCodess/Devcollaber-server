require('dotenv').config();  // must be FIRST line

const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket/socket');

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`DevMatch server running on ${PORT}`));