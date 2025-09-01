import { createSlice } from '@reduxjs/toolkit';

const recordsSlice = createSlice({
  name: 'records',
  initialState: {
    pendingRecords: [],
    syncStatus: 'idle', // 'idle' | 'syncing' | 'error'
    error: null
  },
  reducers: {
    addPendingRecord: (state, action) => {
      state.pendingRecords.push({
        ...action.payload,
        localId: Date.now().toString(), // Temporary local ID
        synced: false
      });
    },
    markRecordAsSynced: (state, action) => {
      const index = state.pendingRecords.findIndex(
        record => record.localId === action.payload
      );
      if (index !== -1) {
        state.pendingRecords[index].synced = true;
      }
    },
    clearSyncedRecords: (state) => {
      state.pendingRecords = state.pendingRecords.filter(record => !record.synced);
    },
    setSyncStatus: (state, action) => {
      state.syncStatus = action.payload;
    },
    setSyncError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const {
  addPendingRecord,
  markRecordAsSynced,
  clearSyncedRecords,
  setSyncStatus,
  setSyncError
} = recordsSlice.actions;

export default recordsSlice.reducer;