# Start here

This runs the café's server on your own computer: the dashboard, the app, and pickup orders. Four steps.

1. **Install Node once.** Go to nodejs.org, download the **LTS** version, and install it (just keep pressing Next). Skip this if you already have it.
2. **Open the folder** you downloaded (unzip it first if it is a zip file).
3. **Double-click START.**
   - Windows: `START.bat`
   - Mac: `START.command` (the first time, right-click it, choose **Open**, then **Open** again)
4. **Answer the few questions** (about a minute). Press Enter to skip any of them. Your browser then opens the dashboard.

That is all. To stop, close the black window. To start again, double-click START again. It remembers your answers.

## Things you may want to do

| I want to... | Do this |
|---|---|
| Sign in to the dashboard | Open `http://localhost:8080/admin/`. The name is `owner` and the password is the one setup showed you. It is also saved in the file called `.env`. |
| Something ran out (an item, or oat milk) | Dashboard > **Menu** > **Sold out today?**: type it and tap it |
| Too busy for new orders for a while | Dashboard: **Busy? Pause pickup orders** (under the tabs), pick how long |
| Change a price | Dashboard > **Menu** |
| Save a copy of my data | It saves one every day by itself. To save one now: `npm run backup`. Then copy the `data/backups` folder to a USB stick or cloud drive. |
| Change hours, phone, or add a promotion | Dashboard > **Site info** |
| Change a password, or add email alerts, Square, or the AI key | Run setup again: open a terminal in this folder and type `npm run setup` |
| Let customers pay in the app (card, Apple Pay), so nobody pays at the counter | Run `npm run setup` and answer the Square **Application ID** question. Read "Paying in the app" in `DEPLOY.md` first, and try it in the Square Sandbox. |
| Put it online so customers can use it | Follow `DEPLOY.md`. Right now the app only works on this computer, because that is where the server is. |

## If something goes wrong

- **"Node is not installed"**: do step 1, then double-click START again.
- **The window closes right away**: open a terminal in this folder and type `npm run go` to see the message.
- **Forgot the dashboard password**: run `npm run setup` and type a new one.
- **Never share the file called `.env`**. It holds your passwords and keys. It is not uploaded anywhere.
