function createChatModel(store) {
  return {
    addContact: (ownerId, contactId) => store.addContact(ownerId, contactId),
    listContacts: (ownerId) => store.listContacts(ownerId),
    listThreads: (ownerId) => store.listThreads(ownerId),
    getChatClearAt: (ownerId, peerId) => store.getChatClearAt(ownerId, peerId),
    clearChat: (ownerId, peerId) => store.clearChat(ownerId, peerId)
  };
}

module.exports = { createChatModel };
