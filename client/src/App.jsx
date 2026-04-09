import React, { useState, useEffect, useRef } from 'react';

const API_URL = "http://localhost:8000/api/steer";
const TICK_RATE_MS = 50; // 20 frames per second
const SPEED = -2.0;      // Moving in reverse
const CAR_LENGTH = 15;   // Distance between axles

function App() {
  const [carState, setCarState] = useState({
    x: -40,       // Start left of spot (in the street)
    y: 80,        // Start ahead of parking spot
    angle: 0,     // Start parallel to curb (facing UP)
    steering: 0,
  });

  const [isRunning, setIsRunning] = useState(false);

  // The main simulation loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      try {
        // Fetch new steering angle from Python Fuzzy Logic Backend
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            x: carState.x,
            y: carState.y,
            angle: carState.angle,
          }),
        });

        const data = await response.json();
        const steeringAngle = data.steering_angle || 0;

        // Kinematic Bicycle Model update step
        setCarState(prev => {
          // Convert angles from degrees to radians for math
          const angleRad = (prev.angle * Math.PI) / 180;
          const steeringRad = (steeringAngle * Math.PI) / 180;

          // In standard 2D top-down view for vehicles pointing UP: 
          // Angle 0 = pointing UP (+Y). Positive angle = pointing LEFT (Counter-Clockwise).
          const headingX = -Math.sin(angleRad);
          const headingY = Math.cos(angleRad);

          const newX = prev.x + (SPEED * headingX);
          const newY = prev.y + (SPEED * headingY);
          
          // update vehicle angle
          const newAngleRad = angleRad + ((SPEED / CAR_LENGTH) * Math.tan(steeringRad));
          let newAngleDeg = (newAngleRad * 180) / Math.PI;

          // Normalize angle to -180...180
          if (newAngleDeg > 180) newAngleDeg -= 360;
          if (newAngleDeg < -180) newAngleDeg += 360;

          return {
            x: newX,
            y: newY,
            angle: newAngleDeg,
            steering: steeringAngle
          };
        });

      } catch (err) {
        console.error("Fuzzy Controller API Error:", err);
      }
    }, TICK_RATE_MS);

    return () => clearInterval(interval);
  }, [isRunning, carState]); // Depend on car state so it captures the latest state to send

  // Map coordinates to CSS pixels
  const scale = 3;
  // Target spot visual center is left=470px, top=260px.
  // Physical x=0 maps to 470, y=0 maps to 260
  const renderX = 470 + (carState.x * scale); 
  const renderY = 260 - (carState.y * scale); 

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-4">Autonomous Parallel Parking Controller</h1>
      <p className="text-gray-400 mb-8">Fuzzy Logic Controller simulation via Python + React</p>
      
      {/* Simulation Area */}
      <div className="relative bg-gray-600 border-2 border-gray-400 rounded-lg overflow-hidden w-[600px] h-[600px] mb-8 shadow-inner shadow-black">
        {/* Curbside Marking */}
        <div className="absolute top-0 right-[150px] w-2 h-full bg-yellow-500 rounded-full opacity-70 border-r-2 border-yellow-300"></div>
        
        {/* Spot markings */}
        <div className="absolute top-[200px] right-[100px] border-2 border-white border-dashed w-[60px] h-[120px] opacity-30">
          <span className="absolute w-full text-center text-xs top-1/2 -translate-y-1/2 font-mono">Target</span>
        </div>

        {/* Parked Car 1 (Front) */}
        <div className="absolute top-[40px] right-[100px] w-[50px] h-[100px] bg-red-800 rounded shadow-md border border-black z-10 flex flex-col items-center justify-center">
            <div className="w-full h-1/4 bg-gray-900 rounded-sm mt-2 opacity-50"></div>
        </div>

        {/* Parked Car 2 (Behind) */}
        <div className="absolute top-[360px] right-[100px] w-[50px] h-[100px] bg-red-800 rounded shadow-md border border-black z-10 flex flex-col items-center justify-center">
            <div className="w-full h-1/4 bg-gray-900 rounded-sm mt-2 opacity-50"></div>
        </div>

        {/* User Autonomous Vehicle */}
        <div 
          className="absolute w-[50px] h-[100px] bg-blue-500 rounded-xl shadow-lg border-2 border-blue-300 z-20 flex flex-col items-center transition-all duration-75"
          style={{
            left: `${renderX}px`,
            top: `${renderY}px`,
            transform: `translate(-50%, -50%) rotate(${-carState.angle}deg)`,
          }}
        >
            <div className="flex-1 w-full bg-blue-500 rounded-t-xl overflow-hidden">
                <div className="w-full h-[20px] bg-cyan-900 mt-4 opacity-80 border-t border-cyan-400"></div>
            </div>
            <div className="flex-1 w-full bg-blue-500 rounded-b-xl overflow-hidden flex flex-col justify-end">
                <div className="w-full h-[15px] bg-red-900 mb-2 opacity-80 border-b border-red-500"></div>
                <div className="absolute top-1 w-full flex justify-between px-1">
                    <div className="w-3 h-2 bg-yellow-200 blur-sm rounded-full"></div>
                    <div className="w-3 h-2 bg-yellow-200 blur-sm rounded-full"></div>
                </div>
            </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-4 gap-4 bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-[600px] border border-gray-700">
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">X Position</span>
          <span className="text-2xl font-mono text-blue-400">{carState.x.toFixed(2)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Y Position</span>
          <span className="text-2xl font-mono text-green-400">{carState.y.toFixed(2)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Vehicle Angle</span>
          <span className="text-2xl font-mono text-purple-400">{carState.angle.toFixed(2)}°</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Steering Angle</span>
          <span className="text-2xl font-mono text-yellow-400">{carState.steering.toFixed(2)}°</span>
        </div>
      </div>

      <div className="mt-8 space-x-4">
        <button 
          onClick={() => setIsRunning(!isRunning)}
          className={"px-6 py-3 rounded-lg font-bold transition-colors " + (isRunning ? '"bg-red-500 hover:bg-red-600 outline-none"' : '"bg-green-500 hover:bg-green-600 outline-none"')}
        >
          {isRunning ? "Stop Simulation" : "Start Simulation"}
        </button>
        <button 
          onClick={() => {
            setIsRunning(false);
            setCarState({x: -40, y: 80, angle: 0, steering: 0});
          }}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors outline-none"
        >
          Reset Position
        </button>
      </div>

    </div>
  );
}

export default App;
