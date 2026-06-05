from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time

app = Flask(__name__)
CORS(app)

data = {
    "supplier": 5000,
    "warehouse": 2000,
    "retailer": 500,
    "alerts": [],
    "history": [],
    "demand_history": []
}

REORDER_QUANTITY = 200
DEMAND_RANGE = (30, 80)

def log_event(message):
    data["history"].append({
        "time": time.strftime("%H:%M:%S"),
        "event": message
    })

def predict_demand():
    if len(data["demand_history"]) == 0:
        return 50
    last = data["demand_history"][-5:]
    return sum(last) // len(last)

@app.route('/status', methods=['GET'])
def status():
    return jsonify(data)

@app.route('/reset', methods=['POST'])
def reset():
    data["supplier"] = 5000
    data["warehouse"] = 2000
    data["retailer"] = 500
    data["alerts"] = []
    data["history"] = []
    data["demand_history"] = []
    log_event("System reset")
    return jsonify({"message": "Reset done"})

@app.route('/simulate', methods=['POST'])
def simulate():
    body = request.get_json(silent=True)

    # Use real sales if provided, else use random
    if body and "demand" in body:
        demand = int(body["demand"])
        log_event(f"Real sales entered: {demand} units")
    else:
        demand = random.randint(*DEMAND_RANGE)
        log_event(f"Simulated demand: {demand} units")

    data["demand_history"].append(demand)

    # RETAILER AGENT — sell to customer
    if data["retailer"] >= demand:
        data["retailer"] -= demand
        log_event(f"Sold {demand} units to customers")
    else:
        sold = data["retailer"]
        data["retailer"] = 0
        log_event(f"Stockout! Only sold {sold} of {demand} units. Lost {demand - sold} sales!")
        data["alerts"].append(f"STOCKOUT! Lost {demand - sold} sales!")

    predicted = predict_demand()

    # RETAILER AGENT — restock check
    if data["retailer"] < predicted * 2:
        if data["warehouse"] >= REORDER_QUANTITY:
            data["warehouse"] -= REORDER_QUANTITY
            data["retailer"] += REORDER_QUANTITY
            data["alerts"].append("✅ Retailer restocked from warehouse")
            log_event(f"Retailer ordered {REORDER_QUANTITY} units from warehouse")
        else:
            data["alerts"].append("⚠️ Warehouse LOW — cannot restock retailer!")
            log_event("Warehouse too low to restock retailer")

    # WAREHOUSE AGENT — restock check
    if data["warehouse"] < predicted * 3:
        if data["supplier"] >= REORDER_QUANTITY:
            data["supplier"] -= REORDER_QUANTITY   # FIXED BUG: was +=
            data["warehouse"] += REORDER_QUANTITY
            data["alerts"].append("✅ Warehouse restocked from supplier")
            log_event(f"Warehouse ordered {REORDER_QUANTITY} units from supplier")
        else:
            data["alerts"].append("🔴 SUPPLIER OUT OF STOCK!")
            log_event("Supplier cannot fulfill warehouse order!")

    return jsonify({
        "message": "Simulation done",
        "demand": demand,
        "predicted_demand": predicted,
        "used_real_data": body and "demand" in body if body else False
    })

if __name__ == '__main__':
    app.run(debug=True)
