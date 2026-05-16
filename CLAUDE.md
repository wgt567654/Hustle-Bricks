# HustleBricks — Claude Instructions

## Always do it for the user
If something can be done programmatically (running the dev server, testing endpoints with curl, running SQL checks, reading files, running builds), **do it without asking**. Never give the user manual steps when Claude can execute them directly. The user should only have to do something manually when it is truly impossible to automate (e.g. clicking inside Supabase dashboard UI, entering payment info).
