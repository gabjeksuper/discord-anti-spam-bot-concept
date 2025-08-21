# Discord Anti Spam Bot - Concept

Single-file concept anti-spam bot for Discord built with **discord.js v14**. 

Minimal config, safe defaults and easy-to-use. 

It deletes the detected message, timeouts the user, assigns a role (optionally posts a public log) and sweeps identical messages sent by the same user in the last **10 minutes** across the guild (excluding configured channels/categories).

> Teaching concept for an all-in-one script (no multi-folder boilerplate).

## Features
- Link detector (Discord/Steam + common typo domains).
- Private log with chunked embeds.
- Optional public log (toggle).
- 24h timeout and role assignment.
- **Duplicate sweeper**: removes identical messages by the same user over the last **N minutes** (default 10), across channels, respecting exclusions.

## Requirements
- [Node.js](https://nodejs.org/en/download) **18+** (recommended 21)
- Bot permissions: Read/Send, **Manage Messages**, **Moderate Members (Timeout)**, **Manage Roles**.
- Intents enabled in Developer Portal: **Guilds**, **Guild Members**, **Guild Messages**, **Message Content**.

## Setup
```bash
cd C:\path\discord-anti-spam-concept
npm install
npm start
```

## Config
Edit the `CONFIG` object at the top of `index.js`:
- `logChannelId`: private logs.
- `antiSpamChannelId`: public logs.
- `enablePublicLog`: `true/false` to enable public logs.
- `antiSpamRoleId`: role to assign when spam is detected (create a role, such as "Anti Spam" or "TempBan", and enter the Discord role ID).
- `allowedRoleIds`: allowed roles that can post any type of link (such as staff roles).
- `exemptCategories`, `exemptChannels`: IDs to ignore (categories/channels).
- `deleteDuplicatesWindowMs`: lookback window for duplicate sweeps.
- `detectionRegex`: tweak if needed.

## Notes
- The duplicate sweep fetches up to the latest **100 messages per channel**.
- Ensure the bot has permissions in all relevant channels.
- There is no .env file because this is an all-in-one script concept that allows you to learn how to get started building an all-in-one bot with everything in one script.

## Pro Tips
Edit the channel and disable the ability to share files in the channel (new spam methods incorporate image spam into channels) || Disable: "Attach files"

## Credits
Discord: gabjeksuper

Want to rent a custom bot, tailored to your server and needs? 100% functional? Send me a private message on Discord (setup + hosting + future changes included).
