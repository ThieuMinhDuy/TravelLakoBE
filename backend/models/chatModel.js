import mongoose from 'mongoose';

const chatMessageSchema = mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'model', 'assistant']
  },
  parts: [
    {
      text: {
        type: String,
        required: true,
      }
    }
  ]
});

const chatSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    messages: [chatMessageSchema]
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
