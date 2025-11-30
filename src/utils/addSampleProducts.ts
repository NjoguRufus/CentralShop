// Utility script to add sample products to Firebase
import { collection } from 'firebase/firestore';
import { addDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';

const sampleProducts = [
  {
    name: 'Coca Cola 500ml',
    price: 50,
    stock: 100,
    category: 'Beverages',
    barcode: '123456789012',
    image: 'https://images.pexels.com/photos/50593/coca-cola-cold-drink-soft-drink-coke-50593.jpeg?auto=compress&cs=tinysrgb&w=400',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Pepsi 500ml',
    price: 45,
    stock: 80,
    category: 'Beverages',
    barcode: '123456789013',
    image: 'https://images.pexels.com/photos/2775860/pexels-photo-2775860.jpeg?auto=compress&cs=tinysrgb&w=400',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Water Bottle',
    price: 25,
    stock: 200,
    category: 'Beverages',
    barcode: '123456789014',
    image: 'https://images.pexels.com/photos/327090/pexels-photo-327090.jpeg?auto=compress&cs=tinysrgb&w=400',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Energy Drink',
    price: 60,
    stock: 50,
    category: 'Beverages',
    barcode: '123456789015',
    image: 'https://images.pexels.com/photos/3819966/pexels-photo-3819966.jpeg?auto=compress&cs=tinysrgb&w=400',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Chocolate Bar',
    price: 35,
    stock: 75,
    category: 'Snacks',
    barcode: '123456789016',
    image: 'https://images.pexels.com/photos/65882/chocolate-dark-coffee-confiserie-65882.jpeg?auto=compress&cs=tinysrgb&w=400',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Sandwich',
    price: 120,
    stock: 30,
    category: 'Food',
    barcode: '123456789017',
    image: 'https://images.pexels.com/photos/1639565/pexels-photo-1639565.jpeg?auto=compress&cs=tinysrgb&w=400',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const addSampleProducts = async () => {
  try {
    for (const product of sampleProducts) {
      await addDoc(collection(db, 'products'), product);
      console.log(`Added product: ${product.name}`);
    }
    console.log('All sample products added successfully!');
  } catch (error) {
    console.error('Error adding sample products:', error);
  }
};



