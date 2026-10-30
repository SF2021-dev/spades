# Chat style backup (2026-10-30)
The gold "message board" chat look (no timestamps/usernames, `>` before the other person's lines, compose box under the last message), saved before the Google-Messages-style redesign.

Restore:
    cp chat-style-backup-2026-10-30/msgbox.js msgbox.js
    cp chat-style-backup-2026-10-30/chat/index.html chat/index.html
    cp chat-style-backup-2026-10-30/group-chat/index.html group-chat/index.html
Then bump the `msgbox.js?v=` number in both pages and redeploy. (gm-chat.css / gm-chat.js are only used by the new look and can stay.)
