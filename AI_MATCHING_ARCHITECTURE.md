# 🤖 AI Job Finder & Matching Architecture Guide

This document provides a comprehensive visual diagram and architectural breakdown of the system workflow, live job ingestion pipeline, candidate pre-filtering engine, local Ollama AI scoring mechanism, and database structure of **AI Job Finder**.

---

## 📐 1. End-to-End System Architecture & Pipeline

```mermaid
graph TD
    A["📄 Resume Upload / Selection"] -->|"Auto-Parse Profile & Skills"| B["👤 Candidate Context"]
    B -->|"Sync Criteria"| C["⚙️ Search Configuration"]
    
    subgraph Live_Ingestion_Engine ["Live Ingestion Engine (8 Connectors)"]
        D1["💼 LinkedIn Public Guest API"]
        D2["🏢 Naukri & Indeed Public Feeds"]
        D3["🌐 Remotive API"]
        D4["🏛️ Greenhouse Boards"]
        D5["📡 WeWorkRemotely RSS"]
        D6["⚡ RemoteOK API"]
    end

    C --> Live_Ingestion_Engine
    Live_Ingestion_Engine -->|"Raw Job Listings"| E["⚡ Candidate Guard & Pre-Filter Engine"]

    subgraph Fast_Token_Guard ["Token Protection Guard (<1ms Execution)"]
        E --> F{"Check 1: Role Compatibility"}
        F -->|"No: Golang, C++, Director"| G["❌ Reject in 0ms"]
        F -->|"Yes"| H{"Check 2: Location & Region Match?"}
        H -->|"No: Foreign On-Site Only"| G
        H -->|"Yes: India / Remote"| I["✅ Candidate-Matched Job"]
    end

    I -->|"Job Description + Resume Text"| J["🧠 Local Ollama AI Engine (qwen2.5)"]

    subgraph AI_Scoring_Stage ["AI Match Scoring Output"]
        J --> K1["📊 Overall Match Score 0-100%"]
        J --> K2["📈 7-Factor Score Breakdown"]
        J --> K3["✅ Matching vs ❌ Missing Skills"]
        J --> K4["💡 AI Strategic Summary"]
    end

    K1 & K2 & K3 & K4 -->|"Insert / Update"| L[("🗄️ SQLite Database")]
    L -->|"Real-Time State"| M["🖥️ Dynamic Candidate Dashboard"]
```

---

## ⏱️ 2. Step-by-Step Execution Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Candidate User
    participant UI as Scanner UI (React)
    participant Server as Backend API Engine
    participant Guard as Pre-Filter Guard Engine
    participant LLM as Local Ollama AI (qwen2.5)
    participant DB as SQLite Local Database

    User->>UI: Click "Start Smart Job Scan"
    UI->>Server: POST /api/scanner/start
    Server->>DB: Fetch Active Candidate Resume & Search Config
    Server->>Server: Query 8 Live Job Feeds (LinkedIn, Naukri, etc.)
    
    loop For Each Raw Job Listing
        Server->>Guard: Validate Title, Role & Location
        alt Irrelevant Role (Golang/Director for Mobile Dev)
            Guard-->>Server: Reject in 0ms (0 Tokens Wasted)
        else Compatible Candidate Job
            Guard-->>Server: Pass Job to AI Evaluation
            Server->>LLM: Send Resume Text + Job Description
            LLM-->>Server: Return JSON (Score, Breakdown, Skills, Summary)
            Server->>DB: INSERT OR REPLACE Job & Analysis
        end
    end

    Server-->>UI: Return Completed Scan Status
    UI-->>User: Display Matched Jobs on Dashboard
```

---

## 🧠 3. Local Ollama AI 7-Factor Match Scoring Matrix

```mermaid
graph LR
    subgraph Ollama_AI_Evaluator ["Ollama AI 7-Factor Match Scoring"]
        AI["🧠 qwen2.5 Model"] --> S1["🎯 Role Alignment (25%)"]
        AI --> S2["🛠️ Technical Skills Match (30%)"]
        AI --> S3["⏳ Experience Fit (20%)"]
        AI --> S4["📍 Location & Flexibility (10%)"]
        AI --> S5["👔 Seniority Level (5%)"]
        AI --> S6["💰 Compensation Alignment (5%)"]
        AI --> S7["💡 Domain Relevance (5%)"]
    end
    S1 & S2 & S3 & S4 & S5 & S6 & S7 --> Score["🏆 Weighted Overall Match Score (0-100%)"]
```

---

## ⚡ 4. Supported Live Ingestion Connectors (8 Feeds)

| Job Source Name | Coverage / Region | Integration Type & URL | Status |
| :--- | :--- | :--- | :--- |
| **LinkedIn Jobs** | India & Global | Direct Public Guest Search API (Official Apply Links) | `LIVE ACTIVE` |
| **Naukri & Indeed Public** | India Tech Hubs | Live Indian Developer Feeds (Ahmedabad, Bengaluru, Pune, Delhi) | `LIVE ACTIVE` |
| **India & Local Public Jobs** | India Regional | Software, Mobile & Full-Stack Regional Feeds | `LIVE ACTIVE` |
| **WeWorkRemotely RSS** | Global Remote | Back-End, Full-Stack, Front-End RSS Feeds | `LIVE ACTIVE` |
| **Remotive Public API** | Global Remote | Live Engineering & Mobile API Endpoint | `LIVE ACTIVE` |
| **Greenhouse Career Boards** | Company Boards | Direct queries for GitLab, Zapier, Elastic, Figma | `LIVE ACTIVE` |
| **RemoteOK Public API** | Global Remote | Dynamic Keyword Tag Search Endpoint | `LIVE ACTIVE` |
| **Jobicy Public API** | Global Public | Engineering Category API Endpoint | `LIVE ACTIVE` |
