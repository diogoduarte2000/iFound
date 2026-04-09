const clientsByUser = new Map();

const writeEvent = (res, eventName, payload) => {
  if (res.writableEnded) {
    return false;
  }

  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  return true;
};

const registerClient = (userId, res) => {
  const key = String(userId);
  const currentClients = clientsByUser.get(key) || new Set();
  currentClients.add(res);
  clientsByUser.set(key, currentClients);

  return () => {
    const nextClients = clientsByUser.get(key);
    if (!nextClients) {
      return;
    }

    nextClients.delete(res);
    if (nextClients.size === 0) {
      clientsByUser.delete(key);
    }
  };
};

const publishToUsers = (userIds, eventName, payload) => {
  const deliveredUsers = new Set();

  for (const userId of userIds) {
    const key = String(userId);
    if (deliveredUsers.has(key)) {
      continue;
    }

    deliveredUsers.add(key);
    const clients = clientsByUser.get(key);

    if (!clients) {
      continue;
    }

    for (const client of [...clients]) {
      const delivered = writeEvent(client, eventName, payload);
      if (!delivered) {
        clients.delete(client);
      }
    }

    if (clients.size === 0) {
      clientsByUser.delete(key);
    }
  }
};

module.exports = {
  publishToUsers,
  registerClient,
  writeEvent,
};
