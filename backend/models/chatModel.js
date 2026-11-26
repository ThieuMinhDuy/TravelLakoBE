import mongoose from 'mongoose';

const chatMessageSchema = mongoose.Schema({
  role: {
    type: String,
    required: [true, 'Thiếu vai trò của tin nhắn'],
    enum: { values: ['user', 'model', 'assistant'], message: 'Vai trò tin nhắn không hợp lệ' },
  },
  parts: [
    {
      text: {
        type: String,
        required: [true, 'Tin nhắn không được để trống'],
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
