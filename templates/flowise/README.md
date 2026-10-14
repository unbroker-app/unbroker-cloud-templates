# Flowise

Build AI agents, chatbots and RAG pipelines with drag-and-drop nodes for every
major LLM, vector store and tool, then call them over an API or embed them on a
site.

## What gets deployed

| Service | Image | Notes |
|---|---|---|
| **Flowise** | `flowiseai/flowise:3.1.4` | Public. 1 GiB volume for uploaded documents and logs |
| **db** | PostgreSQL 16 | Internal. Chatflows, credentials and users |

The secrets Flowise uses to sign sessions and encrypt stored API keys are
generated for you.

## After deploy

Open the URL and create the **admin account**. The first visitor gets it.
Then add your model provider's API key under **Credentials**.

## Notes

On this release a few node types (the ReAct agent nodes and AWS Bedrock) fail to
load because of upstream packaging issues. Every other node works.
