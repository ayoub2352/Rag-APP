# Rag-App

This is an implementation of the RAG model for question answering.


## Requirements

- Python 3.8 or later

#### Install Python using MiniConda

1) Download and install MiniConda from [here](https://docs.anaconda.com/free/miniconda/#quick-command-line-install)
2) Create a new environment using the following command:
```bash
$ conda create -n mini-rag python=3.8
```
3) Activate the environment:
```bash
$ conda activate mini-rag
```

### (Optional) Setup you command line interface for better readability

```bash
export PS1="\[\033[01;32m\]\u@\h:\w\n\[\033[00m\]\$ "
```

### (Optional) Run Ollama Local LLM Server using Colab + Ngrok

- Check the [notebook](https://colab.research.google.com/drive/1dHQV48B8rY3vbok6OBxbqvy3wCaE9N1c?usp=sharing) 

## Installation

### Install the required packages

```bash
$ pip install -r requirements.txt
```

### Setup the environment variables

```bash
$ cp .env.example .env
```

Set your environment variables in the `.env` file. Like `OPENAI_API_KEY` value.

## Run Docker Compose Services

```bash
$ cd docker
$ cp .env.example .env
```

- update `.env` with your credentials



```bash
$ cd docker
$ sudo docker compose up -d
```

## Run the FastAPI server

```bash
$ uvicorn main:app --reload --host 0.0.0.0 --port 5000
```

## POSTMAN Collection

Download the POSTMAN collection from [/assets/mini-rag-app.postman_collection.json](/assets/mini-rag-app.postman_collection.json)

##React FrontEnd

Download Node.js from [Node.js](https://nodejs.org/en)

-verify the installation

```bash
$ node -v
$ npm -v
```

-Use npm (comes with Node.js) to install the required frontend dependencies:

```bash
$ npm install axios @tailwindcss/typography
```

-Install Tailwind CSS and its peer dependencies:

```bash
$ npx tailwindcss init -p
```

-Ensure src/index.css contains the following lines :
```bash
@tailwind base;
@tailwind components;
@tailwind utilities;
```

-and start React App : 

```bash
$ npm start
```

-This will launch the React app, and you can access it in your browser at http://localhost:3000.
