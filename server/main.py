from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

app = FastAPI()

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CarState(BaseModel):
    x: float
    y: float
    angle: float

# --- Fuzzy Logic Setup ---
# Antecedents (Inputs)
x_pos = ctrl.Antecedent(np.arange(-100, 101, 1), 'x_pos')
y_pos = ctrl.Antecedent(np.arange(-100, 101, 1), 'y_pos')
angle = ctrl.Antecedent(np.arange(-180, 181, 1), 'angle')

# Consequent (Output)
steering = ctrl.Consequent(np.arange(-45, 46, 1), 'steering')

# X Position: 0 is center of target spot. Negative is left (in street). Positive is right (on curb).
x_pos['far_left']  = fuzz.trapmf(x_pos.universe, [-100, -100, -30, -5])
x_pos['good']      = fuzz.trimf(x_pos.universe, [-10, 0, 10])
x_pos['far_right'] = fuzz.trapmf(x_pos.universe, [5, 30, 100, 100])

# Y Position: 0 is center of target spot. Positive is ahead. Negative is behind.
y_pos['far_ahead'] = fuzz.trapmf(y_pos.universe, [20, 50, 100, 100])
y_pos['approaching'] = fuzz.trimf(y_pos.universe, [0, 20, 40])
y_pos['target'] = fuzz.trimf(y_pos.universe, [-10, 0, 20])
y_pos['far_behind'] = fuzz.trapmf(y_pos.universe, [-100, -100, -20, -5])

# Angle: 0 is pointing straight up. Positive is facing left. Negative is facing right.
angle['left_facing']  = fuzz.trapmf(angle.universe, [5, 30, 180, 180])
angle['aligned']     = fuzz.trimf(angle.universe, [-10, 0, 10])
angle['right_facing'] = fuzz.trapmf(angle.universe, [-180, -180, -30, -5])

# Steering: Negative is right, Positive is left.
steering['hard_right'] = fuzz.trimf(steering.universe, [-45, -45, -20])
steering['slight_right'] = fuzz.trimf(steering.universe, [-25, -10, 0])
steering['straight'] = fuzz.trimf(steering.universe, [-5, 0, 5])
steering['slight_left'] = fuzz.trimf(steering.universe, [0, 10, 25])
steering['hard_left'] = fuzz.trimf(steering.universe, [20, 45, 45])

# Continuous Parallel Parking Fuzzy Rules
rules = [
    # 1. Starting out, ahead of spot and in street (left) -> Steer hard right to aim rear at spot
    ctrl.Rule(y_pos['far_ahead'] & x_pos['far_left'] & angle['aligned'], steering['hard_right']),
    
    # 2. While approaching, car begins to point left (left_facing). Keep rear turning in
    ctrl.Rule(y_pos['approaching'] & x_pos['far_left'], steering['hard_right']),
    
    # 3. Nearing target Y, we are diagonal (left_facing). Time to straighten out: steer hard left!
    ctrl.Rule(y_pos['target'] & angle['left_facing'], steering['hard_left']),
    
    # 4. If perfectly aligned and in spot -> straight
    ctrl.Rule(x_pos['good'] & y_pos['target'] & angle['aligned'], steering['straight']),
    
    # 5. Corrections & Protections
    ctrl.Rule(angle['right_facing'], steering['hard_left']), # if facing curb too much, steer away
    ctrl.Rule(x_pos['far_right'], steering['hard_left']),    # if overlapping the curb, pull out by steering left
    ctrl.Rule(y_pos['far_behind'], steering['straight'])     # don't keep turning if we backed up too far
]

# Control System Setup
steering_ctrl = ctrl.ControlSystem(rules)
steering_sim = ctrl.ControlSystemSimulation(steering_ctrl)

@app.post("/api/steer")
def steer_car(state: CarState):
    try:
        steering_sim.input['x_pos'] = max(-100, min(100, state.x))
        steering_sim.input['y_pos'] = max(-100, min(100, state.y))
        steering_sim.input['angle'] = max(-180, min(180, state.angle))
        
        try:
            steering_sim.compute()
            steer = steering_sim.output['steering']
        except ValueError:
            steer = 0.0
            
        return {"steering_angle": steer}
    
    except Exception as e:
        print("Error: ", str(e))
        return {"error": str(e), "steering_angle": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
