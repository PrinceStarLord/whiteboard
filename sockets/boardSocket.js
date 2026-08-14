function roomName(boardId) {
  return `board-${boardId}`;
}

function attachBoardSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join-board', (boardId) => {
      socket.join(roomName(boardId));
    });

    socket.on('leave-board', (boardId) => {
      socket.leave(roomName(boardId));
    });
  });
}

module.exports = { attachBoardSocket, roomName };
