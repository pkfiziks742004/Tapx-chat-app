function createMessageModel(store) {
  return {
    listBetween: (a, b, limit, opts) => store.listMessagesBetween(a, b, limit, opts),
    create: ({ from, to, text }) => store.createMessage({ from, to, text }),
    createFile: (payload) => store.createFileMessage(payload),
    markDeliveredOne: (payload) => store.markMessageDelivered(payload),
    markDelivered: (payload) => store.markMessagesDelivered(payload),
    markRead: (payload) => store.markMessagesRead(payload),
    deleteExpired: () => store.deleteExpiredMessages(),
    deleteForMe: (payload) => store.deleteMessageForMe(payload),
    deleteManyForMe: (payload) => store.deleteMessagesForMe(payload),
    deleteForEveryone: (payload) => store.deleteMessageForEveryone(payload),
    deleteManyForEveryone: (payload) => store.deleteMessagesForEveryone(payload),
    forward: (payload) => store.forwardMessage(payload),
    forwardMany: (payload) => store.forwardMessages(payload),

    uploadAttachment: (payload) => store.uploadAttachment(payload),
    createAttachmentSignedUrl: (payload) => store.createAttachmentSignedUrl(payload),
    removeAttachments: (payload) => store.removeAttachments(payload)
  };
}

module.exports = { createMessageModel };
