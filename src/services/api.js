import axios from 'axios';
import {
  mockDashboard, mockProjects, mockTasks, mockKanbanColumns, mockTaskList,
  mockPlanKPIs, mockActuals, mockOpportunities, mockClosedDeals,
  mockExpenseSystemParams, mockExpenseList, mockProjectsDropdown, mockExpenseReports,
  mockExpenseOverview, mockWeeklyReport, mockBackupData, mockDropdownKeys, addDropdownValueMock,
} from '../mocks/data';

// COMMENT dòng này lại nếu chưa có backend
// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
//   headers: { 'Content-Type': 'application/json' }
// });

// ============================================
// MOCK API - Dùng dữ liệu giả để chạy frontend
// ============================================

// Mock API cho Dashboard
export const getDashboardData = async () => {
  // Giả lập delay như gọi API thật
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockDashboard;
};

// Mock API cho Projects
export const getProjects = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: mockProjects };
};

// Mock API cho Tasks
export const getTasks = async (filters) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  let tasks = [...mockTasks];
  
  // Simulate filter
  if (filters?.project) {
    tasks = tasks.filter(t => t.project === filters.project);
  }
  if (filters?.status) {
    tasks = tasks.filter(t => t.status === filters.status);
  }
  
  return { data: tasks };
};

// Mock API cho Task List (chi tiết)
export const getTaskList = async (filters) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  let tasks = [...mockTaskList];
  if (filters?.project && filters.project !== 'All Projects') {
    tasks = tasks.filter(t => t.project === filters.project);
  }
  if (filters?.status && filters.status !== 'All Status') {
    tasks = tasks.filter(t => t.status === filters.status);
  }
  if (filters?.priority && filters.priority !== 'All Priorities') {
    tasks = tasks.filter(t => t.priority === filters.priority);
  }
  if (filters?.assignee && filters.assignee !== 'Everyone') {
    tasks = tasks.filter(t => t.assignee.name === filters.assignee);
  }
  return { data: tasks, total: tasks.length };
};

// Mock API cho Kanban Board
export const getKanbanData = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockKanbanColumns)) };
};

// Mock API cho Leads & KPIs
export const getPlanKPIs = async (year) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: { ...mockPlanKPIs, year: year || mockPlanKPIs.year } };
};

export const savePlanKPIs = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const getActuals = async (week) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: { ...mockActuals, week: week || mockActuals.week } };
};

export const saveActuals = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const getOpportunities = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: [...mockOpportunities] };
};

export const addOpportunity = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return { data: { ...data, id: Date.now() } };
};

export const updateOpportunity = async (id, data) => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return { data: { ...data, id } };
};

export const convertToWon = async (id) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { id, status: 'won' } };
};

export const getClosedDeals = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: [...mockClosedDeals] };
};

// Mock cho các API khác
export const createProject = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const updateProject = async (id, data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id } };
};

export const deleteProject = async (id) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true };
};

export const createTask = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const updateTask = async (id, data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id } };
};

export const deleteTask = async (id) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true };
};

// Mock API cho Expense Management
export const getExpenseSystemParams = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: [...mockExpenseSystemParams] };
};

export const saveExpenseSystemParam = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const getExpenseList = async (project) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  let list = [...mockExpenseList];
  if (project) {
    list = list.filter(e => e.project === project);
  }
  return { data: list };
};

export const saveExpense = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { data: { ...data, id: Date.now() } };
};

export const getExpenseReports = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockExpenseReports)) };
};

export const getExpenseOverview = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockExpenseOverview)) };
};

export const getProjectsDropdown = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { data: [...mockProjectsDropdown] };
};

// Mock API cho Weekly Report
export const getWeeklyReport = async (filters) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  let data = JSON.parse(JSON.stringify(mockWeeklyReport));
  if (filters?.project && filters.project !== 'All Projects') {
    data.project = filters.project;
  }
  if (filters?.week) data.week = filters.week;
  if (filters?.year) data.year = filters.year;
  return { data };
};

// Mock API cho Data Management
export const getBackupData = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockBackupData)) };
};

export const getDropdownKeys = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { data: JSON.parse(JSON.stringify(mockDropdownKeys)) };
};

export const addDropdownValue = async (keyId, label) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const newVal = addDropdownValueMock(keyId, label);
  return { data: newVal };
};

export const deleteDropdownValue = async (keyId, valueId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { success: true };
};

// Auth mock
export const login = async (email, password) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  if (email === 'admin@mkthub.com' && password === 'password123') {
    return {
      data: {
        token: 'mock-jwt-token',
        user: { id: 1, name: 'Truc Nguyen', email: 'admin@mkthub.com', role: 'manager' }
      }
    };
  }
  throw new Error('Invalid credentials');
};

// Export mặc định (cho các API không cần mock)
export default {
  getDashboardData,
  getProjects,
  getTasks,
  getTaskList,
  getKanbanData,
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
  login,
  getPlanKPIs,
  savePlanKPIs,
  getActuals,
  saveActuals,
  getOpportunities,
  addOpportunity,
  updateOpportunity,
  convertToWon,
  getClosedDeals,
  getExpenseSystemParams,
  saveExpenseSystemParam,
  getExpenseList,
  saveExpense,
  getExpenseReports,
  getExpenseOverview,
  getProjectsDropdown,
  getBackupData,
  getDropdownKeys,
  addDropdownValue,
  deleteDropdownValue,
};