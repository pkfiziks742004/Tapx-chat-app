import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { api, authApi } from "../api/api.js";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconGlobe,
  IconHelp,
  IconLock,
  IconLogout,
  IconPencil,
  IconSend,
  IconShield,
  IconUser,
  IconX
} from "./Icons.jsx";

export default function WorkspaceSidebar({
  className = "sidebar settingsSidebar",
  mode = "settings",
  token,
  me,
  myEmail,
  settings,
  onChangeSettings,
  onUpdatedMe,
  onEditProfile,
  onLogout,
  showToast
}) {
  const [openSection, setOpenSection] = useState("personal"); // 'personal' | 'privacy' | 'security' | 'help'
  const [timeString, setTimeString] = useState("");
  const [userStatus, setUserStatus] = useState(settings?.presence || "Available");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Personal Info Edit States
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(me?.name || "");
  const [editingBio, setEditingBio] = useState(false);
  const [bioVal, setBioVal] = useState(me?.bio || "");
  const [locationVal, setLocationVal] = useState(settings?.location || "California, USA");
  const [editingLocation, setEditingLocation] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Privacy states
  const [profilePhotoVisibility, setProfilePhotoVisibility] = useState(settings?.profilePhotoVisibility || "Everyone");
  const [lastSeen, setLastSeen] = useState(settings?.lastSeen !== false);
  const [statusVisibility, setStatusVisibility] = useState(settings?.statusVisibility || "Everyone");
  const [readReceipts, setReadReceipts] = useState(settings?.readReceipts !== false);
  const [groupsVisibility, setGroupsVisibility] = useState(settings?.groupsVisibility || "Everyone");

  // Security & Password states
  const [securityNotifications, setSecurityNotifications] = useState(settings?.securityNotifications !== false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Help & Support states
  const [openFaq, setOpenFaq] = useState(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSent, setSupportSent] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setNameVal(me?.name || "");
    setBioVal(me?.bio || "");
  }, [me]);

  useEffect(() => {
    function updateClock() {
      const d = new Date();
      setTimeString(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  function toggleSection(sec) {
    setOpenSection((prev) => (prev === sec ? "" : sec));
  }

  function handleStatusChange(st) {
    setUserStatus(st);
    setStatusDropdownOpen(false);
    const next = { ...(settings || {}), presence: st };
    onChangeSettings?.(next);
    showToast?.(`Status set to ${st}`);
  }

  async function handleSaveName() {
    const trimmed = nameVal.trim();
    if (!trimmed) return;
    setSavingProfile(true);
    try {
      const res = await api.updateMe(token, trimmed, me?.bio || "");
      if (res?.user) onUpdatedMe?.(res.user);
      setEditingName(false);
      showToast?.("Name updated successfully");
    } catch (err) {
      showToast?.(err?.message || "Failed to update name");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveBio() {
    setSavingProfile(true);
    try {
      const res = await api.updateMe(token, me?.name || "", bioVal.trim());
      if (res?.user) onUpdatedMe?.(res.user);
      setEditingBio(false);
      showToast?.("About info updated");
    } catch (err) {
      showToast?.(err?.message || "Failed to update bio");
    } finally {
      setSavingProfile(false);
    }
  }

  function handleSaveLocation() {
    setEditingLocation(false);
    const next = { ...(settings || {}), location: locationVal.trim() };
    onChangeSettings?.(next);
    showToast?.("Location updated");
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast?.("Uploading profile photo...");
      const res = await api.uploadAvatar(token, file);
      if (res?.user) onUpdatedMe?.(res.user);
      showToast?.("Profile photo updated!");
    } catch (err) {
      showToast?.(err?.message || "Failed to upload avatar");
    }
  }

  function handlePrivacyUpdate(key, value) {
    const next = { ...(settings || {}), [key]: value };
    onChangeSettings?.(next);
    showToast?.("Privacy settings updated");
  }

  async function handleChangePassword(e) {
    e?.preventDefault?.();
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.setPassword(token, newPassword, currentPassword);
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast?.("Password changed successfully!");
      setTimeout(() => setShowPasswordForm(false), 2000);
    } catch (err) {
      setPasswordError(err?.message || "Could not change password.");
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleSendSupport() {
    if (!supportMessage.trim()) return;
    setSupportSent(true);
    showToast?.("Support request sent! We will respond shortly.");
    setSupportMessage("");
    setTimeout(() => setSupportSent(false), 3000);
  }

  const name = me?.name || myEmail?.split("@")[0] || "User";

  return (
    <aside className={className}>
      <div className="sidebarHeader">
        <h1 className="sidebarTitle">Settings</h1>
      </div>

      <div className="settingsProfileHeader">
        <div className="settingsAvatarWrap">
          <Avatar name={name} url={me?.avatarUrl} size={84} />
          <button
            className="settingsAvatarEditBtn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload Profile Photo"
            title="Upload Profile Photo"
          >
            <IconPencil size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
        </div>

        <h2 className="settingsUserName">{name}</h2>

        <div className="settingsStatusWrap">
          <button
            className="settingsStatusBtn"
            type="button"
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
          >
            <span className={`settingsStatusDot ${userStatus.toLowerCase()}`} />
            <span>{userStatus}</span>
            <IconChevronDown size={14} />
          </button>

          {statusDropdownOpen && (
            <div className="settingsStatusMenu">
              {["Available", "Busy", "Away", "Offline"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`settingsStatusMenuItem ${userStatus === st ? "active" : ""}`}
                  onClick={() => handleStatusChange(st)}
                >
                  <span className={`statusDot ${st.toLowerCase()}`} />
                  <span>{st}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="settingsAccordionList">
        {/* 1) Personal Info */}
        <div className="settingsAccordionItem">
          <button
            className={`settingsAccordionHeader ${openSection === "personal" ? "open" : ""}`}
            type="button"
            onClick={() => toggleSection("personal")}
          >
            <span>Personal Info</span>
            {openSection === "personal" ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>

          <AnimatePresence>
            {openSection === "personal" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="settingsAccordionBody"
              >
                {/* Name */}
                <div className="settingsFieldRow">
                  <div className="settingsFieldLabel">Name</div>
                  {editingName ? (
                    <div className="settingsInlineEditRow">
                      <input
                        type="text"
                        className="settingsInput"
                        value={nameVal}
                        onChange={(e) => setNameVal(e.target.value)}
                        placeholder="Enter your name"
                        autoFocus
                      />
                      <button
                        className="settingsActionBtn save"
                        type="button"
                        onClick={handleSaveName}
                        disabled={savingProfile}
                      >
                        <IconCheck size={14} />
                      </button>
                      <button
                        className="settingsActionBtn cancel"
                        type="button"
                        onClick={() => {
                          setEditingName(false);
                          setNameVal(me?.name || "");
                        }}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="settingsFieldValueWithAction">
                      <span className="settingsFieldValue">{name}</span>
                      <button
                        className="settingsEditActionBtn"
                        type="button"
                        onClick={() => setEditingName(true)}
                      >
                        <IconPencil size={12} />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* About / Bio */}
                <div className="settingsFieldRow">
                  <div className="settingsFieldLabel">About</div>
                  {editingBio ? (
                    <div className="settingsInlineEditRow">
                      <input
                        type="text"
                        className="settingsInput"
                        value={bioVal}
                        onChange={(e) => setBioVal(e.target.value)}
                        placeholder="Say something about yourself"
                        autoFocus
                      />
                      <button
                        className="settingsActionBtn save"
                        type="button"
                        onClick={handleSaveBio}
                        disabled={savingProfile}
                      >
                        <IconCheck size={14} />
                      </button>
                      <button
                        className="settingsActionBtn cancel"
                        type="button"
                        onClick={() => {
                          setEditingBio(false);
                          setBioVal(me?.bio || "");
                        }}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="settingsFieldValueWithAction">
                      <span className="settingsFieldValue">{me?.bio || "Available for chat"}</span>
                      <button
                        className="settingsEditActionBtn"
                        type="button"
                        onClick={() => setEditingBio(true)}
                      >
                        <IconPencil size={12} />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="settingsFieldRow">
                  <div className="settingsFieldLabel">Email</div>
                  <div className="settingsFieldValue">{myEmail || "user@example.com"}</div>
                </div>

                {/* Location */}
                <div className="settingsFieldRow">
                  <div className="settingsFieldLabel">Location</div>
                  {editingLocation ? (
                    <div className="settingsInlineEditRow">
                      <input
                        type="text"
                        className="settingsInput"
                        value={locationVal}
                        onChange={(e) => setLocationVal(e.target.value)}
                        placeholder="Your city / country"
                        autoFocus
                      />
                      <button className="settingsActionBtn save" type="button" onClick={handleSaveLocation}>
                        <IconCheck size={14} />
                      </button>
                      <button
                        className="settingsActionBtn cancel"
                        type="button"
                        onClick={() => {
                          setEditingLocation(false);
                          setLocationVal(settings?.location || "California, USA");
                        }}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="settingsFieldValueWithAction">
                      <span className="settingsFieldValue">{locationVal}</span>
                      <button
                        className="settingsEditActionBtn"
                        type="button"
                        onClick={() => setEditingLocation(true)}
                      >
                        <IconPencil size={12} />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="settingsFieldRow">
                  <div className="settingsFieldLabel">Time</div>
                  <div className="settingsFieldValue">{timeString || "12:00 PM"}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2) Privacy */}
        <div className="settingsAccordionItem">
          <button
            className={`settingsAccordionHeader ${openSection === "privacy" ? "open" : ""}`}
            type="button"
            onClick={() => toggleSection("privacy")}
          >
            <span>Privacy</span>
            {openSection === "privacy" ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>

          <AnimatePresence>
            {openSection === "privacy" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="settingsAccordionBody"
              >
                <div className="settingsPrivacyRow">
                  <span className="settingsPrivacyLabel">Profile photo</span>
                  <select
                    className="settingsSelect"
                    value={profilePhotoVisibility}
                    onChange={(e) => {
                      setProfilePhotoVisibility(e.target.value);
                      handlePrivacyUpdate("profilePhotoVisibility", e.target.value);
                    }}
                  >
                    <option value="Everyone">Everyone</option>
                    <option value="Contacts">Contacts Only</option>
                    <option value="Nobody">Nobody</option>
                  </select>
                </div>

                <div className="settingsPrivacyRow">
                  <span className="settingsPrivacyLabel">Last seen</span>
                  <button
                    className={`settingsToggleSwitch ${lastSeen ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      const next = !lastSeen;
                      setLastSeen(next);
                      handlePrivacyUpdate("lastSeen", next);
                    }}
                    aria-pressed={lastSeen}
                  >
                    <span className="settingsToggleThumb" />
                  </button>
                </div>

                <div className="settingsPrivacyRow">
                  <span className="settingsPrivacyLabel">Status Visibility</span>
                  <select
                    className="settingsSelect"
                    value={statusVisibility}
                    onChange={(e) => {
                      setStatusVisibility(e.target.value);
                      handlePrivacyUpdate("statusVisibility", e.target.value);
                    }}
                  >
                    <option value="Everyone">Everyone</option>
                    <option value="Contacts">Contacts Only</option>
                    <option value="Nobody">Nobody</option>
                  </select>
                </div>

                <div className="settingsPrivacyRow">
                  <span className="settingsPrivacyLabel">Read receipts</span>
                  <button
                    className={`settingsToggleSwitch ${readReceipts ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      const next = !readReceipts;
                      setReadReceipts(next);
                      handlePrivacyUpdate("readReceipts", next);
                    }}
                    aria-pressed={readReceipts}
                  >
                    <span className="settingsToggleThumb" />
                  </button>
                </div>

                <div className="settingsPrivacyRow">
                  <span className="settingsPrivacyLabel">Groups</span>
                  <select
                    className="settingsSelect"
                    value={groupsVisibility}
                    onChange={(e) => {
                      setGroupsVisibility(e.target.value);
                      handlePrivacyUpdate("groupsVisibility", e.target.value);
                    }}
                  >
                    <option value="Everyone">Everyone</option>
                    <option value="Contacts">Contacts Only</option>
                    <option value="Nobody">Nobody</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3) Security */}
        <div className="settingsAccordionItem">
          <button
            className={`settingsAccordionHeader ${openSection === "security" ? "open" : ""}`}
            type="button"
            onClick={() => toggleSection("security")}
          >
            <span>Security</span>
            {openSection === "security" ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>

          <AnimatePresence>
            {openSection === "security" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="settingsAccordionBody"
              >
                <div className="settingsPrivacyRow">
                  <span className="settingsPrivacyLabel">Security Notifications</span>
                  <button
                    className={`settingsToggleSwitch ${securityNotifications ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      const next = !securityNotifications;
                      setSecurityNotifications(next);
                      handlePrivacyUpdate("securityNotifications", next);
                    }}
                  >
                    <span className="settingsToggleThumb" />
                  </button>
                </div>

                {/* Change Password */}
                <div className="settingsSecurityActionRow">
                  <button
                    className="settingsSecondaryBtn"
                    type="button"
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                  >
                    <IconLock size={15} />
                    <span>{showPasswordForm ? "Hide Password Form" : "Change Password"}</span>
                  </button>
                </div>

                {showPasswordForm && (
                  <form className="settingsPasswordForm" onSubmit={handleChangePassword}>
                    {passwordError && <div className="settingsFormError">{passwordError}</div>}
                    {passwordSuccess && <div className="settingsFormSuccess">{passwordSuccess}</div>}

                    <div className="settingsFormField">
                      <label>Current Password</label>
                      <input
                        type="password"
                        className="settingsInput"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>

                    <div className="settingsFormField">
                      <label>New Password</label>
                      <input
                        type="password"
                        className="settingsInput"
                        placeholder="Min 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div className="settingsFormField">
                      <label>Confirm Password</label>
                      <input
                        type="password"
                        className="settingsInput"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    <button
                      className="settingsPrimaryBtn"
                      type="submit"
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                )}

                {onLogout && (
                  <div style={{ marginTop: 14 }}>
                    <button className="settingsSignoutBtn" type="button" onClick={onLogout}>
                      <IconLogout size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4) Help & Support */}
        <div className="settingsAccordionItem">
          <button
            className={`settingsAccordionHeader ${openSection === "help" ? "open" : ""}`}
            type="button"
            onClick={() => toggleSection("help")}
          >
            <span>Help</span>
            {openSection === "help" ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>

          <AnimatePresence>
            {openSection === "help" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="settingsAccordionBody"
              >
                {/* FAQs */}
                <div className="settingsHelpSection">
                  <div className="settingsHelpSectionTitle">Frequently Asked Questions</div>
                  <div className="settingsFaqList">
                    <div className="settingsFaqItem">
                      <button
                        className="settingsFaqQuestion"
                        type="button"
                        onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
                      >
                        <span>How to make video / voice calls?</span>
                        <IconChevronDown size={14} className={openFaq === 1 ? "rotate" : ""} />
                      </button>
                      {openFaq === 1 && (
                        <div className="settingsFaqAnswer">
                          Open any chat with a contact and click the phone 📞 or video camera 📹 icon at the top right of the chat window.
                        </div>
                      )}
                    </div>

                    <div className="settingsFaqItem">
                      <button
                        className="settingsFaqQuestion"
                        type="button"
                        onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
                      >
                        <span>How to copy, forward or delete messages?</span>
                        <IconChevronDown size={14} className={openFaq === 2 ? "rotate" : ""} />
                      </button>
                      {openFaq === 2 && (
                        <div className="settingsFaqAnswer">
                          Hover over any message bubble and click the 3-dots icon on the top right of the message to Copy, Forward, or Delete.
                        </div>
                      )}
                    </div>

                    <div className="settingsFaqItem">
                      <button
                        className="settingsFaqQuestion"
                        type="button"
                        onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
                      >
                        <span>Are calls and messages encrypted?</span>
                        <IconChevronDown size={14} className={openFaq === 3 ? "rotate" : ""} />
                      </button>
                      {openFaq === 3 && (
                        <div className="settingsFaqAnswer">
                          Yes! All WebRTC audio/video calls and real-time messages are secure and encrypted peer-to-peer.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Support */}
                <div className="settingsHelpSection">
                  <div className="settingsHelpSectionTitle">Contact Support</div>
                  <div className="settingsSupportBox">
                    <textarea
                      className="settingsTextarea"
                      placeholder="Describe your question or issue..."
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      rows={3}
                    />
                    <button
                      className="settingsPrimaryBtn"
                      type="button"
                      onClick={handleSendSupport}
                      disabled={!supportMessage.trim()}
                    >
                      <IconSend size={14} />
                      <span>{supportSent ? "Sent!" : "Send Message"}</span>
                    </button>
                  </div>
                </div>

                {/* Terms & Privacy */}
                <div className="settingsHelpSection">
                  <div className="settingsHelpSectionTitle">Terms & Privacy</div>
                  <div className="settingsTermsBox">
                    Tapx Chat protects your privacy. We do not sell your personal data or chat contents.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
