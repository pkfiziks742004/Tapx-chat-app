import { motion } from "framer-motion";
import {
  IconBell,
  IconGlobe,
  IconLogout,
  IconSettings,
  IconShield,
  IconSparkles,
  IconUser
} from "./Icons.jsx";

function SettingSwitch({ active = false, onToggle }) {
  return (
    <button className={active ? "settingsToggle active" : "settingsToggle"} type="button" onClick={onToggle} aria-pressed={active}>
      <span />
    </button>
  );
}

function SegmentedBtn({ active = false, label, onClick }) {
  return (
    <button className={active ? "settingsSegmentBtn active" : "settingsSegmentBtn"} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

export default function SettingsWorkspace({
  className = "chat",
  settings,
  onChange,
  me,
  myEmail,
  onEditProfile,
  onLogout
}) {
  const safe = settings || {};
  const theme = safe.theme || "dark";
  const wallpaper = safe.wallpaper || "default";

  function update(patch) {
    onChange?.({ ...safe, ...(patch || {}) });
  }

  return (
    <main className={className}>
      <div className="sectionWorkspace settingsWorkspace">
        <motion.section
          className="sectionHero settingsPageHero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sectionHeroBackdrop settingsPageBackdrop" aria-hidden="true" />
          <div className="sectionHeroMain">
            <div className="settingsHeroIdentity">
              <span className="settingsHeroIcon">
                <IconSettings className="btnSvg" size={22} />
              </span>
              <div>
                <span className="sectionHeroTag">Preferences</span>
                <div className="sectionHeroTitle">Personalize your messenger</div>
                <div className="sectionHeroSub">
                  Fine tune theme, privacy, motion, and notification behavior without breaking the premium app feel.
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="sectionContentGrid settingsContentGrid">
          <motion.article
            className="sectionCard settingsSectionCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.02 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">Appearance</span>
                <h3>Theme and surfaces</h3>
              </div>
            </div>

            <div className="settingsSegment">
              <SegmentedBtn active={theme === "dark"} label="Dark" onClick={() => update({ theme: "dark" })} />
              <SegmentedBtn active={theme === "light"} label="Light" onClick={() => update({ theme: "light" })} />
              <SegmentedBtn active={theme === "system"} label="System" onClick={() => update({ theme: "system" })} />
            </div>

            <div className="settingsOptionGrid">
              <button
                className={wallpaper === "default" ? "settingsVisualOption active" : "settingsVisualOption"}
                type="button"
                onClick={() => update({ wallpaper: "default" })}
              >
                <span className="settingsVisualSwatch gradientA" />
                <strong>Soft blend</strong>
              </button>
              <button
                className={wallpaper === "doodles" ? "settingsVisualOption active" : "settingsVisualOption"}
                type="button"
                onClick={() => update({ wallpaper: "doodles" })}
              >
                <span className="settingsVisualSwatch gradientB" />
                <strong>Doodles</strong>
              </button>
              <button
                className={wallpaper === "solid" ? "settingsVisualOption active" : "settingsVisualOption"}
                type="button"
                onClick={() => update({ wallpaper: "solid" })}
              >
                <span className="settingsVisualSwatch gradientC" />
                <strong>Solid</strong>
              </button>
            </div>
          </motion.article>

          <motion.article
            className="sectionCard settingsSectionCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">Controls</span>
                <h3>Notifications and motion</h3>
              </div>
            </div>

            <div className="settingsRow">
              <div className="settingsRowLead">
                <span className="settingsRowIcon"><IconBell className="btnSvg" size={16} /></span>
                <div>
                  <strong>Message sounds</strong>
                  <small>Play lightweight audio cues for incoming activity.</small>
                </div>
              </div>
              <SettingSwitch active={safe.messageSounds !== false} onToggle={() => update({ messageSounds: safe.messageSounds === false })} />
            </div>

            <div className="settingsRow">
              <div className="settingsRowLead">
                <span className="settingsRowIcon"><IconSparkles className="btnSvg" size={16} /></span>
                <div>
                  <strong>Reduce motion</strong>
                  <small>Dial back interface animation intensity across the app.</small>
                </div>
              </div>
              <SettingSwitch active={Boolean(safe.reduceMotion)} onToggle={() => update({ reduceMotion: !safe.reduceMotion })} />
            </div>
          </motion.article>

          <motion.article
            className="sectionCard settingsSectionCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">Privacy</span>
                <h3>Visibility and safety</h3>
              </div>
            </div>

            <div className="settingsRow">
              <div className="settingsRowLead">
                <span className="settingsRowIcon"><IconShield className="btnSvg" size={16} /></span>
                <div>
                  <strong>Read receipts</strong>
                  <small>Show when your messages have been seen by collaborators.</small>
                </div>
              </div>
              <SettingSwitch active={safe.readReceipts !== false} onToggle={() => update({ readReceipts: safe.readReceipts === false })} />
            </div>

            <div className="settingsRow">
              <div className="settingsRowLead">
                <span className="settingsRowIcon"><IconGlobe className="btnSvg" size={16} /></span>
                <div>
                  <strong>Presence sharing</strong>
                  <small>Let teammates know when you are available for quick replies.</small>
                </div>
              </div>
              <SettingSwitch active={safe.presenceSharing !== false} onToggle={() => update({ presenceSharing: safe.presenceSharing === false })} />
            </div>
          </motion.article>
        </section>

        <motion.section
          className="sectionCard settingsAccountCard"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.11 }}
        >
          <div className="sectionCardHeader">
            <div>
              <span className="sectionCardEyebrow">Account</span>
              <h3>Profile and device controls</h3>
            </div>
          </div>

          <div className="settingsAccountSummary">
            <span className="settingsRowIcon"><IconUser className="btnSvg" size={16} /></span>
            <div>
              <strong>{me?.name || "Your profile"}</strong>
              <small>{myEmail || "Signed in"}</small>
            </div>
          </div>

          <div className="settingsActionRow">
            <button className="sectionSecondaryAction" type="button" onClick={onEditProfile}>
              <IconUser className="btnSvg" size={16} />
              <span>Edit profile</span>
            </button>
            <button className="sectionSecondaryAction danger" type="button" onClick={onLogout}>
              <IconLogout className="btnSvg" size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
