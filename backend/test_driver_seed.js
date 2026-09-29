const db = require('./db.js');
const bcrypt = require('bcryptjs');

try {
  // cleanup
  db.prepare("DELETE FROM users WHERE name='John Driver'").run();
  db.prepare("DELETE FROM drivers WHERE name='John Driver'").run();

  const saltRounds = 10;
  const hash = bcrypt.hashSync('driver123', saltRounds);

  const qUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING *');
  const user = qUser.get('John Driver', 'john@driver.com', hash, 'Driver');
  
  const qDriver = db.prepare('INSERT INTO drivers (name, license_type, status) VALUES (?, ?, ?) RETURNING *');
  const driver = qDriver.get('John Driver', 'CDL', 'OnDuty');

  db.prepare("DELETE FROM trips WHERE driver_id=?").run(driver.id);

  const vehicle = db.prepare("SELECT id FROM vehicles LIMIT 1").get();
  const veh_id = vehicle ? vehicle.id : 1; 

  const qTrip = db.prepare('INSERT INTO trips (vehicle_id, driver_id, start_location, end_location, start_odometer, status, revenue) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *');
  const trip = qTrip.get(veh_id, driver.id, 'Chicago HQ', 'Dallas Depot', 10000, 'Dispatched', 2000);

  console.log("SUCCESS creating User and Trip:", trip.id);
} catch (err) {
  console.error("ERROR:", err);
}
