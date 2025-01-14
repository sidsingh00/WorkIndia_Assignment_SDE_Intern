const db = require('../config/db');
const Train = require('../models/Train');
const Booking = require('../models/Booking');


// logic for getting seat

exports.getSeat = async (req, res) => {

  const { source, destination } = req.query;
  
  if(!source || !destination){
    return res.status(400).json({
      message:'Data is not filled'
    })
  }
  
  try {
    const trains = await Train.getTrainsByRoute(source, destination);
  
    if (trains.length === 0) {
      return res.status(404).json({ 
        message: 'No trains available for this route' 
      });
    }

    // mapping the train with the avaiable train and seat
    const availableTrains = trains.map(train => (
      {
      trainNumber: train.train_number,
      availableSeats: train.available_seats
    }
  )
);

const trainSeats = availableTrains.filter(train => train.availableSeats > 0);

  // cnt the number of trains and seat details

  res.status(200).json({
    available: trainSeats.length > 0,
    availableTrainCount: trainSeats.length, 
    trains: availableTrains
  });

} 
  catch (err) {
    console.error('Error Finding seat availability:', err);
    res.status(500).json({ 
        message: 'Error fetching seat availability', error: err.message 
      }
    );
  }
};
  

//Logic for booking 
exports.bookSeat = async (req, res) => {

  const { trainId, seatsToBook } = req.body;
  const userId = req.user.id;
  
  const conn = await db.getConnection();
  try {
    console.log("start Booking tickets");
      
    await conn.beginTransaction();
    console.log("start Transaction");
  
      
    const [train] = await conn.query('SELECT total_seats, available_seats FROM trains WHERE id = ? FOR UPDATE', [trainId]);
    console.log("Train fetched:", train);
  
    
    if (!train.length) {
      console.log("Train not found");
      await conn.rollback();
      return res.status(404).json({ message: 'Train not found' });
    }
  
    const availableSeats = train[0].available_seats;
    console.log("Available seats:", availableSeats);
  
    if (availableSeats < seatsToBook) {

      console.log("Not seats available");

      await conn.rollback();
      return res.status(400).json({ 
        message: 'Not seats available' 
      }
    );
    
  }
    

    await conn.query('UPDATE trains SET available_seats = available_seats - ? WHERE id = ?', [seatsToBook, trainId]);
    console.log("Seats updated");
  

    await Booking.create(userId, trainId, seatsToBook, conn);
    console.log("Booking Done"); 
  
    // Commit the transaction
    await conn.commit();
    res.json({ message: 'Seats booked successfully' });

  } catch (err) {

      console.error("Error during booking:", err.message); // Log error message
      await conn.rollback();

      res.status(500).json({ 
        message: 'Error booking seats', error: err.message 
      });
      
    } finally {
      
      connection.release();
    }
  };


  
//getting all the boooking details of user 
exports.getBookingDetail = async (req, res) => {
    const userId = req.user.id;
  
    try {
      const query = `
        SELECT 
          b.id AS booking_id,
          b.seats AS number_of_seats,
          t.train_number,
          t.source,
          t.destination
        FROM bookings b
        JOIN trains t ON b.train_id = t.id
        WHERE b.user_id = ?
      `;
  
      const [rows] = await db.query(query, [userId]);
      res.json(rows);
    } catch (err) {
      console.error(
        'Error fetching booking details:', err.message
      );
      res.status(500).json({ 
        message: 'Error fetching booking details' 
      });
    }
  };
  