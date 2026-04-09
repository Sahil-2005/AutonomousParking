from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl
import math

app = FastAPI()

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Obstacle(BaseModel):
    x: float
    y: float


class CarState(BaseModel):
    x: float
    y: float
    angle: float        # heading in degrees: 0=right, positive=clockwise (screen coords)
    goal_x: float
    goal_y: float
    obstacles: List[Obstacle]


# --- Helper ---
def normalize_angle(angle):
    """Normalize angle to [-180, 180] range."""
    while angle > 180:
        angle -= 360
    while angle < -180:
        angle += 360
    return angle


# ===================================
#  FUZZY LOGIC SETUP
# ===================================

# --- Antecedents (Inputs) ---
angle_to_goal  = ctrl.Antecedent(np.arange(-180, 181, 1), 'angle_to_goal')
obstacle_dist  = ctrl.Antecedent(np.arange(0, 501, 1), 'obstacle_dist')
obstacle_angle = ctrl.Antecedent(np.arange(-180, 181, 1), 'obstacle_angle')

# --- Consequent (Output) ---
steering = ctrl.Consequent(np.arange(-45, 46, 1), 'steering')

# ===================================
#  MEMBERSHIP FUNCTIONS
# ===================================

# angle_to_goal: difference between car heading and direction to goal
# Negative = goal is counter-clockwise (left), Positive = goal is clockwise (right)
angle_to_goal['neg_large'] = fuzz.trapmf(angle_to_goal.universe, [-180, -180, -50, -20])
angle_to_goal['neg_small'] = fuzz.trimf(angle_to_goal.universe, [-35, -15, 0])
angle_to_goal['zero']      = fuzz.trimf(angle_to_goal.universe, [-12, 0, 12])
angle_to_goal['pos_small'] = fuzz.trimf(angle_to_goal.universe, [0, 15, 35])
angle_to_goal['pos_large'] = fuzz.trapmf(angle_to_goal.universe, [20, 50, 180, 180])

# obstacle_dist: distance to nearest obstacle in the forward hemisphere
obstacle_dist['very_close'] = fuzz.trapmf(obstacle_dist.universe, [0, 0, 40, 70])
obstacle_dist['close']      = fuzz.trimf(obstacle_dist.universe, [50, 90, 140])
obstacle_dist['far']        = fuzz.trapmf(obstacle_dist.universe, [110, 170, 500, 500])

# obstacle_angle: relative angle to nearest obstacle from car heading
# Negative = obstacle to the left, Positive = obstacle to the right
obstacle_angle['left']  = fuzz.trapmf(obstacle_angle.universe, [-180, -180, -30, 0])
obstacle_angle['ahead'] = fuzz.trimf(obstacle_angle.universe, [-35, 0, 35])
obstacle_angle['right'] = fuzz.trapmf(obstacle_angle.universe, [0, 30, 180, 180])

# steering: output steering angle
# Negative = turn left (counter-clockwise), Positive = turn right (clockwise)
steering['hard_left']  = fuzz.trapmf(steering.universe, [-45, -45, -35, -20])
steering['left']       = fuzz.trimf(steering.universe, [-30, -15, 0])
steering['straight']   = fuzz.trimf(steering.universe, [-8, 0, 8])
steering['right']      = fuzz.trimf(steering.universe, [0, 15, 30])
steering['hard_right'] = fuzz.trapmf(steering.universe, [20, 35, 45, 45])

# ===================================
#  FUZZY RULES
# ===================================
rules = [
    # ===== GOAL SEEKING (obstacles are far away) =====
    ctrl.Rule(obstacle_dist['far'] & angle_to_goal['neg_large'], steering['hard_left']),
    ctrl.Rule(obstacle_dist['far'] & angle_to_goal['neg_small'], steering['left']),
    ctrl.Rule(obstacle_dist['far'] & angle_to_goal['zero'],      steering['straight']),
    ctrl.Rule(obstacle_dist['far'] & angle_to_goal['pos_small'], steering['right']),
    ctrl.Rule(obstacle_dist['far'] & angle_to_goal['pos_large'], steering['hard_right']),

    # ===== OBSTACLE AVOIDANCE — very close (emergency) =====
    # Obstacle to the left  → hard right to dodge
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['left'],  steering['hard_right']),
    # Obstacle to the right → hard left to dodge
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['right'], steering['hard_left']),
    # Obstacle dead ahead → dodge toward the goal's side
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['ahead'] & angle_to_goal['neg_large'], steering['hard_left']),
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['ahead'] & angle_to_goal['neg_small'], steering['hard_left']),
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['ahead'] & angle_to_goal['zero'],      steering['hard_left']),
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['ahead'] & angle_to_goal['pos_small'], steering['hard_right']),
    ctrl.Rule(obstacle_dist['very_close'] & obstacle_angle['ahead'] & angle_to_goal['pos_large'], steering['hard_right']),

    # ===== OBSTACLE AVOIDANCE — close (moderate) =====
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['left'],  steering['right']),
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['right'], steering['left']),
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['ahead'] & angle_to_goal['neg_large'], steering['hard_left']),
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['ahead'] & angle_to_goal['neg_small'], steering['left']),
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['ahead'] & angle_to_goal['zero'],      steering['left']),
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['ahead'] & angle_to_goal['pos_small'], steering['right']),
    ctrl.Rule(obstacle_dist['close'] & obstacle_angle['ahead'] & angle_to_goal['pos_large'], steering['hard_right']),
]

# Build the Control System
steering_ctrl = ctrl.ControlSystem(rules)
steering_sim = ctrl.ControlSystemSimulation(steering_ctrl)


@app.post("/api/steer")
def steer_car(state: CarState):
    try:
        # 1. Compute angle to goal relative to car heading
        dx_goal = state.goal_x - state.x
        dy_goal = state.goal_y - state.y
        goal_direction = math.degrees(math.atan2(dy_goal, dx_goal))
        atg = normalize_angle(goal_direction - state.angle)

        # 2. Find the nearest obstacle in the forward hemisphere (±90°)
        nearest_dist = 500.0
        nearest_angle = 0.0

        for obs in state.obstacles:
            dx = obs.x - state.x
            dy = obs.y - state.y
            dist = math.sqrt(dx * dx + dy * dy)
            obs_direction = math.degrees(math.atan2(dy, dx))
            rel_angle = normalize_angle(obs_direction - state.angle)

            # Only consider obstacles roughly in front of the car
            if abs(rel_angle) <= 90 and dist < nearest_dist:
                nearest_dist = dist
                nearest_angle = rel_angle

        # 3. Feed inputs to the fuzzy controller (clamped to universe ranges)
        steering_sim.input['angle_to_goal']  = max(-180, min(180, atg))
        steering_sim.input['obstacle_dist']  = max(0, min(500, nearest_dist))
        steering_sim.input['obstacle_angle'] = max(-180, min(180, nearest_angle))

        # 4. Compute the fuzzy output
        try:
            steering_sim.compute()
            steer = steering_sim.output['steering']
        except ValueError:
            steer = 0.0

        return {"steering_angle": round(steer, 2)}

    except Exception as e:
        print("Error:", str(e))
        return {"error": str(e), "steering_angle": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
