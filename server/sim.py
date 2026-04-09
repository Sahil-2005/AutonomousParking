import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

# --- Exact same fuzzy setup as main.py ---
x_pos = ctrl.Antecedent(np.arange(-100, 101, 1), 'x_pos')
angle = ctrl.Antecedent(np.arange(-180, 181, 1), 'angle')
steering = ctrl.Consequent(np.arange(-45, 46, 1), 'steering')

x_pos['far_left']  = fuzz.trapmf(x_pos.universe, [-100, -100, -20, -10])
x_pos['left']      = fuzz.trimf(x_pos.universe, [-20, -10, 0])
x_pos['good']      = fuzz.trimf(x_pos.universe, [-5, 0, 5])
x_pos['right']     = fuzz.trapmf(x_pos.universe, [0, 10, 100, 100])

angle['right_facing'] = fuzz.trapmf(angle.universe, [-180, -180, -8, 0])
angle['aligned']      = fuzz.trimf(angle.universe, [-8, 0, 8])
angle['left_moderate']= fuzz.trimf(angle.universe, [3, 15, 35])
angle['left_steep']   = fuzz.trapmf(angle.universe, [20, 35, 180, 180])

steering['hard_right']   = fuzz.trapmf(steering.universe, [-45, -45, -30, -15])
steering['slight_right'] = fuzz.trimf(steering.universe, [-25, -10, 0])
steering['straight']     = fuzz.trimf(steering.universe, [-10, 0, 10])
steering['slight_left']  = fuzz.trimf(steering.universe, [0, 15, 30])
steering['hard_left']    = fuzz.trapmf(steering.universe, [15, 30, 45, 45])

rules = [
    ctrl.Rule(x_pos['far_left'] & angle['right_facing'], steering['hard_right']),
    ctrl.Rule(x_pos['far_left'] & angle['aligned'], steering['hard_right']),
    ctrl.Rule(x_pos['far_left'] & angle['left_moderate'], steering['hard_right']),
    ctrl.Rule(x_pos['far_left'] & angle['left_steep'], steering['straight']),

    ctrl.Rule(x_pos['left'] & angle['right_facing'], steering['hard_right']),
    ctrl.Rule(x_pos['left'] & angle['aligned'], steering['straight']),
    ctrl.Rule(x_pos['left'] & angle['left_moderate'], steering['hard_left']),
    ctrl.Rule(x_pos['left'] & angle['left_steep'], steering['hard_left']),

    ctrl.Rule(x_pos['good'] & angle['right_facing'], steering['slight_right']),
    ctrl.Rule(x_pos['good'] & angle['aligned'], steering['straight']),
    ctrl.Rule(x_pos['good'] & angle['left_moderate'], steering['hard_left']),
    ctrl.Rule(x_pos['good'] & angle['left_steep'], steering['hard_left']),

    ctrl.Rule(x_pos['right'] & angle['right_facing'], steering['slight_left']),
    ctrl.Rule(x_pos['right'] & angle['aligned'], steering['hard_left']),
    ctrl.Rule(x_pos['right'] & angle['left_moderate'], steering['hard_left']),
    ctrl.Rule(x_pos['right'] & angle['left_steep'], steering['hard_left']),
]

steering_ctrl = ctrl.ControlSystem(rules)
steering_sim = ctrl.ControlSystemSimulation(steering_ctrl)

# --- Simulate exactly like the live app ---
Y_THRESHOLD = 30
x, y, a = -25.0, 55.0, 0.0
speed = -2.0
car_length = 15.0

print(f"{'Step':<6} {'X':<10} {'Y':<10} {'Angle':<10} {'Steer':<10} {'Phase':<10}")
print("-" * 56)

for i in range(80):
    if y > Y_THRESHOLD:
        steer = 0.0
        phase = "STRAIGHT"
    else:
        steering_sim.input['x_pos'] = max(-100, min(100, x))
        steering_sim.input['angle'] = max(-180, min(180, a))
        try:
            steering_sim.compute()
            steer = steering_sim.output['steering']
        except ValueError as e:
            print(f"!!! ValueError at step {i}: X={x:.1f}, A={a:.1f} -> {e}")
            steer = 0.0
        phase = "FUZZY"

    if i % 3 == 0:
        print(f"{i:<6} {x:<10.1f} {y:<10.1f} {a:<10.1f} {steer:<10.1f} {phase:<10}")

    a_rad = np.radians(a)
    steer_rad = np.radians(steer)
    hx = -np.sin(a_rad)
    hy = np.cos(a_rad)
    x += speed * hx
    y += speed * hy
    da_rad = (speed / car_length) * np.tan(steer_rad)
    a += np.degrees(da_rad)
    if a > 180: a -= 360
    if a < -180: a += 360

    # Auto-stop (same as frontend)
    if abs(x) < 7 and abs(a) < 7 and y < 5 and y > -50:
        print(f"\n*** PARKED at step {i+1}: X={x:.1f}, Y={y:.1f}, Angle={a:.1f} ***")
        break
