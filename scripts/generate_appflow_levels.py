import json
import random

sensors = ['btn_action', 'accelerometer', 'light_sensor', 'gps', 'battery', 'gyroscope', 'mic', 'nfc', 'camera', 'thermometer']
events = {
    'btn_action': ['click', 'long_press'],
    'accelerometer': ['shake'],
    'light_sensor': ['dark'],
    'gps': ['arrive'],
    'battery': ['low_level'],
    'gyroscope': ['shake'],
    'mic': ['loud_noise'],
    'nfc': ['scan'],
    'camera': ['face_detect'],
    'thermometer': ['high_temp']
}
logics = ['if_morning', 'if_night', 'if_wifi', 'if_no_wifi', 'if_driving', 'and_facedown', 'and_moving']
actions = ['sound', 'flashlight', 'brightness_down', 'silent_mode', 'notify', 'dnd_mode', 'pay', 'unlock', 'call_911', 'music']

levels = []

# Levels 1-25 (Preserve original structure conceptually, but we can just dynamically generate everything after 25)
# Actually, I'll just write a JS script that replaces the LEVELS array in game.js with a 60-level array.
