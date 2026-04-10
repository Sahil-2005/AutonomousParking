# 🚗 Autonomous Parking Simulator

A web-based autonomous parking simulation that utilizes **Fuzzy Logic** to navigate a car towards a goal while gracefully avoiding obstacles. 🚥

The project is structured with a 🎨 **Frontend Client** for visualization and a ⚙️ **Backend Server** that handles the complex fuzzy logic steering controller.

## ✨ Features
- 🧠 **Fuzzy Logic Control**: Utilizes `scikit-fuzzy` to compute the steering angle based on the relative distance and angle to the goal, as well as the position of nearby obstacles.
- ⚡ **Real-time Steering API**: A REST API built with FastAPI that continuously processes the car's current state and responds with optimal steering adjustments.
- 🎮 **Interactive Simulation**: A modern frontend built with React, Vite, and TailwindCSS to visually simulate the parking environment and track the vehicle's path.

## 🛠️ Tech Stack
- **Frontend**: ⚛️ React, ⚡ Vite, 🌬️ Tailwind CSS
- **Backend**: 🐍 Python, 🚀 FastAPI, 🦄 uvicorn, 📉 scikit-fuzzy, 🔢 NumPy, 📝 pydantic

## 📂 Directory Structure

```text
AutonomousParking/
├── client/                 # 🖥️ React frontend application
│   ├── public/             # 📁 Static assets
│   ├── src/                # 💻 React source code components & styles
│   ├── package.json        # 📦 Frontend dependencies
│   └── vite.config.js      # ⚙️ Vite configuration
└── server/                 # 🗄️ FastAPI backend application
    ├── main.py             # 🚪 FastAPI server entry point and endpoints
    ├── sim.py              # 🧠 Core fuzzy logic rules and simulation engine
    └── requirements.txt    # 🐍 Python dependencies
```

## 🚀 Getting Started

### 📋 Prerequisites
- 🟢 Node.js (for the client)
- 🐍 Python 3.8+ (for the server)

### 🏃‍♂️ Running the Application

1. **Start the Backend Server** ⚙️:
   Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   pip install -r requirements.txt
   python main.py
   # Alternatively, you can use uvicorn directly: uvicorn main:app --reload
   ```
   *The FastAPI server will be running at http://localhost:8000*

2. **Start the Frontend Client** 🎨:
   Open another terminal and navigate to the `client` directory:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *The React application will be accessible at http://localhost:5173*

## 📖 Overview

The vehicle evaluates its environment via a set of rules defined in the backend `sim.py`/`main.py`. These rules dictate the necessary steering adjustments (e.g., pulling a hard-left ⬅️ or straight ⬆️) based on 'very close' 🛑, 'close' ⚠️, and 'far' 🟢 obstacles alongside the desired destination trajectory. 🎯

---

## 👨‍💻 Author
**Sahil Gawade**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Sahil-2005)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/sahil-gawade-920a0a242/)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:gawadesahil.dev@gmail.com)
[![LeetCode](https://img.shields.io/badge/LeetCode-FFA116?style=for-the-badge&logo=leetcode&logoColor=white)](https://leetcode.com/u/sahilgawade4321/)
[![Portfolio](https://img.shields.io/badge/Portfolio-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://sahil-gawade.vercel.app/)
