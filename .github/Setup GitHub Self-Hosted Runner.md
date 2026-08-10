# Setup GitHub Self-Hosted Runner

## Step 1: Go to your GitHub repo settings

1. Open your repository  
2. Navigate to:  
   Settings → Actions → Runners  
3. Click:  
   New self-hosted runner  

---

## Step 2: Choose your OS

Select your operating system:

- Linux (recommended)  
- Windows (if you're using Windows)  
- macOS  

GitHub will generate setup commands like below.

---

## Step 3: Run commands on your machine

### Example (Linux / Ubuntu / EC2)

```bash
mkdir actions-runner && cd actions-runner

curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz

tar xzf ./actions-runner.tar.gz
```

---

## Configure runner (IMPORTANT)

GitHub will provide a command like:

```bash
./config.sh --url https://github.com/your-username/your-repo --token YOUR_TOKEN
```

Copy and run this command on your machine.

---

## Start the runner

```bash
./run.sh
```

---

## Done

Your machine is now connected to GitHub Actions.