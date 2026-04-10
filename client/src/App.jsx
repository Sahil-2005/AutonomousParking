import React, { useState, useEffect, useRef } from 'react';

const API_URL = "http://localhost:8000/api/steer";
const TICK_RATE_MS = 50;   // 20 fps
const SPEED = 2.0;         // Forward speed (pixels per tick)
const CAR_LENGTH = 28;     // Axle distance for bicycle model

const CANVAS_W = 750;
const CANVAS_H = 540;

// Red obstacle cars scattered in the middle of the road
const OBSTACLES = [
  { x: 220, y: 130 },
  { x: 320, y: 290 },
  { x: 250, y: 440 },
  { x: 450, y: 160 },
  { x: 480, y: 380 },
  { x: 350, y: 200 },
  { x: 450, y: 90 },
  { x: 450, y: 270 },
  { x: 450, y: 217 },
  { x: 450, y: 380 },
];

// 3 parking slots on the right side
const PARKING_SLOTS = [
  { id: 1, x: 660, y: 110, label: "Slot 1" },
  { id: 2, x: 660, y: 270, label: "Slot 2" },
  { id: 3, x: 660, y: 430, label: "Slot 3" },
];

const INITIAL_CAR = { x: 60, y: 270, angle: 0, steering: 0 };

function App() {
  const [carState, setCarState] = useState({ ...INITIAL_CAR });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isParked, setIsParked] = useState(false);
  const [path, setPath] = useState([]);

  const carStateRef = useRef(carState);
  const processingRef = useRef(false);
  const startTimerRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    carStateRef.current = carState;
  }, [carState]);

  // Click a parking slot → select it, reset car, and auto-start
  const handleSlotClick = (slot) => {
    if (isRunning) return;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);

    setIsRunning(false);
    setIsParked(false);
    setPath([]);
    setCarState({ ...INITIAL_CAR });
    setSelectedSlot(slot);

    // Small delay for React to process state resets before starting
    startTimerRef.current = setTimeout(() => {
      setIsRunning(true);
    }, 200);
  };

  // Main simulation loop
  useEffect(() => {
    if (!isRunning || !selectedSlot) return;

    const interval = setInterval(async () => {
      // Prevent overlapping API calls
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const current = carStateRef.current;

        // Call the Python fuzzy logic backend
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x: current.x,
            y: current.y,
            angle: current.angle,
            goal_x: selectedSlot.x,
            goal_y: selectedSlot.y,
            obstacles: OBSTACLES,
          }),
        });

        const data = await response.json();
        const steeringAngle = data.steering_angle || 0;

        // Bicycle model kinematics
        const headingRad = (current.angle * Math.PI) / 180;
        const steeringRad = (steeringAngle * Math.PI) / 180;

        const newX = current.x + SPEED * Math.cos(headingRad);
        const newY = current.y + SPEED * Math.sin(headingRad);

        let newAngleDeg =
          current.angle +
          ((SPEED / CAR_LENGTH) * Math.tan(steeringRad) * 180) / Math.PI;

        // Normalize angle to -180..180
        if (newAngleDeg > 180) newAngleDeg -= 360;
        if (newAngleDeg < -180) newAngleDeg += 360;

        setCarState({
          x: newX,
          y: newY,
          angle: newAngleDeg,
          steering: steeringAngle,
        });

        // Add to path trail (every 10px)
        setPath((prev) => {
          if (
            prev.length === 0 ||
            Math.hypot(
              newX - prev[prev.length - 1].x,
              newY - prev[prev.length - 1].y
            ) > 10
          ) {
            return [...prev, { x: newX, y: newY }];
          }
          return prev;
        });
      } catch (err) {
        console.error("Fuzzy Controller API Error:", err);
      } finally {
        processingRef.current = false;
      }
    }, TICK_RATE_MS);

    return () => clearInterval(interval);
  }, [isRunning, selectedSlot]);

  // Auto-stop when the car reaches the goal
  useEffect(() => {
    if (!isRunning || !selectedSlot) return;

    const dx = carState.x - selectedSlot.x;
    const dy = carState.y - selectedSlot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) {
      setIsRunning(false);
      setIsParked(true);
    }

    // Safety: stop if car goes out of bounds
    if (
      carState.x < -30 ||
      carState.x > CANVAS_W + 30 ||
      carState.y < -30 ||
      carState.y > CANVAS_H + 30
    ) {
      setIsRunning(false);
    }
  }, [carState, isRunning, selectedSlot]);

  const handleReset = () => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    setIsRunning(false);
    setIsParked(false);
    setSelectedSlot(null);
    setPath([]);
    setCarState({ ...INITIAL_CAR });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
        Autonomous Parking Controller
      </h1>
      <p className="text-gray-400 mb-6">
        Fuzzy Logic Navigation &amp; Obstacle Avoidance — Python + React
      </p>

      {/* Status Banner */}
      <div className="mb-4 text-sm h-6">
        {!selectedSlot && (
          <span className="text-yellow-400 animate-pulse">
            👆 Click a parking slot on the right to begin
          </span>
        )}
        {selectedSlot && isRunning && (
          <span className="text-green-400">
            🚗 Navigating to {selectedSlot.label}...
          </span>
        )}
        {isParked && (
          <span className="text-cyan-400">
            ✅ Successfully parked in {selectedSlot.label}!
          </span>
        )}
      </div>

      {/* ===== SIMULATION CANVAS ===== */}
      <div
        className="relative bg-gray-600 border-2 border-gray-500 rounded-xl overflow-hidden mb-8 shadow-2xl"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        {/* Road surface */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-600 via-gray-600 to-gray-500 opacity-80" />

        {/* Center road dashes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full flex flex-col items-center justify-evenly opacity-20">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="w-[2px] h-6 bg-yellow-400" />
          ))}
        </div>

        {/* Parking area separator (yellow line) */}
        <div
          className="absolute top-0 w-[3px] h-full bg-yellow-500 opacity-70 rounded-full"
          style={{ left: CANVAS_W - 120 }}
        />

        {/* Path Trail */}
        {path.map((p, i) => (
          <div
            key={i}
            className="absolute w-[5px] h-[5px] bg-blue-400 rounded-full"
            style={{
              left: p.x,
              top: p.y,
              opacity: 0.15 + (i / path.length) * 0.4,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* Parking Slots */}
        {PARKING_SLOTS.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          return (
            <div
              key={slot.id}
              onClick={() => handleSlotClick(slot)}
              className={`absolute border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300
                flex items-center justify-center select-none
                ${isSelected
                  ? isParked
                    ? "border-green-400 bg-green-500/20 shadow-lg shadow-green-500/20"
                    : "border-cyan-400 bg-cyan-500/15 animate-pulse shadow-lg shadow-cyan-500/20"
                  : "border-white/25 hover:border-white/50 hover:bg-white/5"
                }`}
              style={{
                left: slot.x - 30,
                top: slot.y - 40,
                width: 60,
                height: 80,
              }}
            >
              <span
                className={`text-xs font-bold tracking-wide ${isSelected
                  ? isParked
                    ? "text-green-300"
                    : "text-cyan-300"
                  : "text-white/40"
                  }`}
              >
                {slot.label}
              </span>
            </div>
          );
        })}

        {/* Obstacle Cars (Red) — oriented vertically */}
        {OBSTACLES.map((obs, i) => (
          <div
            key={`obs-${i}`}
            className="absolute flex flex-col items-center justify-center rounded shadow-lg border border-red-950"
            style={{
              left: obs.x - 14,
              top: obs.y - 28,
              width: 28,
              height: 55,
              background:
                "linear-gradient(180deg, #991b1b 0%, #7f1d1d 50%, #991b1b 100%)",
            }}
          >
            {/* Windshield */}
            <div className="w-[20px] h-[10px] bg-gray-800/60 rounded-sm mt-2 border border-gray-600/30" />
            <div className="flex-1" />
            {/* Rear window */}
            <div className="w-[18px] h-[8px] bg-gray-800/50 rounded-sm mb-2 border border-gray-600/20" />
          </div>
        ))}

        {/* ===== AUTONOMOUS VEHICLE (Blue) — facing right ===== */}
        <div
          className="absolute z-20"
          style={{
            left: carState.x,
            top: carState.y,
            transform: `translate(-50%, -50%) rotate(${carState.angle}deg)`,
          }}
        >
          <div
            className="relative rounded-lg border-2 border-blue-300 flex items-center"
            style={{
              width: 55,
              height: 28,
              background:
                "linear-gradient(90deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)",
              boxShadow: "0 0 15px rgba(59, 130, 246, 0.4)",
            }}
          >
            {/* Headlights (front = right side) */}
            <div
              className="absolute -right-[1px] top-[3px] w-[4px] h-[4px] bg-yellow-200 rounded-full"
              style={{ boxShadow: "0 0 4px #fef08a" }}
            />
            <div
              className="absolute -right-[1px] bottom-[3px] w-[4px] h-[4px] bg-yellow-200 rounded-full"
              style={{ boxShadow: "0 0 4px #fef08a" }}
            />
            {/* Windshield */}
            <div className="absolute right-[10px] top-[4px] w-[14px] h-[18px] bg-cyan-900/50 rounded-[2px] border border-cyan-400/30" />
            {/* Tail lights (rear = left side) */}
            <div
              className="absolute -left-[1px] top-[3px] w-[4px] h-[4px] bg-red-500 rounded-full"
              style={{ boxShadow: "0 0 4px #ef4444" }}
            />
            <div
              className="absolute -left-[1px] bottom-[3px] w-[4px] h-[4px] bg-red-500 rounded-full"
              style={{ boxShadow: "0 0 4px #ef4444" }}
            />
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div
        className="grid grid-cols-4 gap-4 bg-gray-800/80 backdrop-blur p-6 rounded-xl shadow-lg border border-gray-700"
        style={{ width: CANVAS_W }}
      >
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            X Position
          </span>
          <span className="text-2xl font-mono text-blue-400">
            {carState.x.toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            Y Position
          </span>
          <span className="text-2xl font-mono text-green-400">
            {carState.y.toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            Heading
          </span>
          <span className="text-2xl font-mono text-purple-400">
            {carState.angle.toFixed(1)}°
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            Steering
          </span>
          <span className="text-2xl font-mono text-yellow-400">
            {carState.steering.toFixed(1)}°
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6">
        <button
          onClick={handleReset}
          className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors outline-none border border-gray-600 hover:border-gray-500 shadow-md"
        >
          🔄 Reset Simulation
        </button>
      </div>
    </div>
  );
}

export default App;
