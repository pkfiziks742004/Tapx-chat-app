import Avatar from "./Avatar.jsx";
import {
  IconBell,
  IconChat,
  IconGlobe,
  IconInfo,
  IconMic,
  IconMicOff,
  IconMoon,
  IconPhoneEnd,
  IconShield,
  IconSpeaker,
  IconUser,
  IconVideo
} from "./Icons.jsx";

function InfoRow({ label, value }) {
  return (
    <div className="showcaseInfoRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ShowcaseBottomRow({ me = null, myEmail = "", selected = null }) {
  const peerTitle = selected?.name || selected?.email || "Rahul Verma";

  return (
    <div className="showcaseBottomGrid">
      <section className="showcaseCard call">
        <div className="showcaseCardHeader">
          <span>Voice Call</span>
          <button type="button">x</button>
        </div>
        <div className="showcaseCallBody">
          <div className="avatarWithPresence large">
            <Avatar name={peerTitle} url={selected?.avatarUrl} size={96} />
          </div>
          <div className="showcaseCallName">{peerTitle}</div>
          <div className="showcaseCallTime">02:34</div>
        </div>
        <div className="showcaseCallActions">
          <button type="button">
            <IconMic className="btnSvg" size={18} />
          </button>
          <button type="button">
            <IconSpeaker className="btnSvg" size={18} />
          </button>
          <button type="button">
            <IconMicOff className="btnSvg" size={18} />
          </button>
          <button className="danger" type="button">
            <IconPhoneEnd className="btnSvg" size={18} />
          </button>
        </div>
      </section>

      <section className="showcaseCard video">
        <div className="showcaseCardHeader">
          <span>Video Call</span>
        </div>
        <div className="showcaseVideoCanvas">
          <div className="showcaseVideoAvatarStage">
            <div className="showcaseVideoAvatar">
              <Avatar name={peerTitle} url={selected?.avatarUrl} size={118} />
            </div>
          </div>
          <div className="showcaseVideoPip">
            <Avatar name={me?.name || myEmail || "Me"} url={me?.avatarUrl} size={48} />
          </div>
          <div className="showcaseVideoControls">
            <button type="button">
              <IconVideo className="btnSvg" size={18} />
            </button>
            <button type="button">
              <IconMic className="btnSvg" size={18} />
            </button>
            <button className="danger" type="button">
              <IconPhoneEnd className="btnSvg" size={18} />
            </button>
          </div>
        </div>
      </section>

      <section className="showcaseCard profile">
        <div className="showcaseCardHeader">
          <span>Profile</span>
        </div>
        <div className="showcaseProfileHead">
          <div className="avatarWithPresence">
            <Avatar name={me?.name || myEmail || "Me"} url={me?.avatarUrl} size={72} />
          </div>
          <div>
            <div className="showcaseProfileName">{me?.name || "Prashant Gupta"}</div>
            <div className="showcaseProfileStatus">Online</div>
            <div className="showcaseProfileBio">{me?.bio || "Hey there! I am using AeroChat."}</div>
          </div>
        </div>
        <div className="showcaseInfoList">
          <InfoRow label="Status" value="Available" />
          <InfoRow label="Phone" value="+91 98765 43210" />
          <InfoRow label="Email" value={myEmail || "prashant@example.com"} />
        </div>
      </section>

      <section className="showcaseCard settings">
        <div className="showcaseCardHeader">
          <span>Settings</span>
        </div>
        <div className="showcaseSettingsList">
          <div><span className="showcaseSettingLeft"><IconUser className="btnSvg" size={14} />Account</span><b>&gt;</b></div>
          <div><span className="showcaseSettingLeft"><IconShield className="btnSvg" size={14} />Privacy</span><b>&gt;</b></div>
          <div><span className="showcaseSettingLeft"><IconBell className="btnSvg" size={14} />Notifications</span><b>&gt;</b></div>
          <div><span className="showcaseSettingLeft"><IconChat className="btnSvg" size={14} />Chats</span><b>&gt;</b></div>
          <div><span className="showcaseSettingLeft"><IconMoon className="btnSvg" size={14} />Appearance</span><strong>Dark</strong></div>
          <div><span className="showcaseSettingLeft"><IconGlobe className="btnSvg" size={14} />Language</span><strong>English</strong></div>
          <div><span className="showcaseSettingLeft"><IconInfo className="btnSvg" size={14} />Help &amp; About</span><b>&gt;</b></div>
        </div>
      </section>
    </div>
  );
}
