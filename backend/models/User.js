function createUserModel(store) {
  return {
    getById: (id) => store.getUserById(id),
    getByEmail: (email) => store.getUserByEmail(email),
    getAuthById: (id) => store.getUserAuthById(id),
    getAuthByEmail: (email) => store.getUserAuthByEmail(email),
    create: ({ email, emailVerified } = {}) => store.createUser({ email, emailVerified }),
    setEmailVerified: (id, value) => store.setUserEmailVerified(id, value),
    updateName: (id, name) => store.updateUserName(id, name),
    updateBio: (id, bio) => store.updateUserBio(id, bio),
    updateProfile: (id, payload) => store.updateUserProfile(id, payload),
    updateAvatar: (id, payload) => store.updateUserAvatar({ userId: id, ...payload }),
    setPasswordHash: (id, passwordHash) => store.setUserPasswordHash(id, passwordHash),

    uploadAttachment: (payload) => store.uploadAttachment(payload),
    removeAttachments: (payload) => store.removeAttachments(payload),
    otp: {
      getLatest: (email, purpose) => store.getLatestEmailOtp(email, purpose),
      create: (payload) => store.createEmailOtp(payload),
      getValid: (payload) => store.getValidEmailOtp(payload),
      consumeById: (id) => store.consumeEmailOtpById(id)
    }
  };
}

module.exports = { createUserModel };
