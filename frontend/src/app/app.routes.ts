import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/admin/dashboard/dashboard';
import { Users } from './pages/admin/users/users';
import { Faculty } from './pages/admin/faculty/faculty';
import { SubjectManagement } from './pages/admin/subject-management/subject-management';
import { Rooms } from './pages/admin/rooms/rooms';
import { BatchManagement } from './pages/admin/batch-management/batch-management';
import { Uploads } from './pages/admin/uploads/uploads';
import { Timetables } from './pages/admin/timetables/timetables';
import { TeacherDashboard } from './pages/faculty/teacher-dashboard/teacher-dashboard';
import { Timetable } from './pages/faculty/timetable/timetable';
import { QueryRetrievalComponent } from './query-retrieval/query-retrieval';
import { AcademicSessionManagement } from './pages/admin/academic-session-management/academic-session-management';
import { LunchConfiguration } from './pages/admin/lunch-configuration/lunch-configuration';
import { Component } from '@angular/core';

export const routes: Routes = [

    
  {
    path: 'login',
    component: Login
  },

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'admin/dashboard',
    component: Dashboard
  },

  {
  path: 'admin/academic-sessions',
  component: AcademicSessionManagement
},

  {
    path: 'admin/users',
    component: Users
  },

  {
    path: 'admin/faculty',
    component: Faculty
  },

  {
    path: 'admin/subjects',
    component: SubjectManagement
  },

  {
    path: 'admin/rooms',
    component: Rooms
  },

  {
    path: 'admin/batch-management',
    component: BatchManagement
  },

  {
    path: 'admin/uploads',
    component: Uploads
  },

  {
    path: 'admin/timetables',
    component: Timetables
  },

  {
    path: 'admin/lock-lunch',
    component: LunchConfiguration
  },

  {
  path: 'admin/faculty',
  component: Faculty
  },

  {
  path: 'teacher/dashboard',
  component: TeacherDashboard
  },

  {
  path: 'teacher/timetable',
  component: Timetable
},

{
  path: 'admin/query-retrieval',
  component: QueryRetrievalComponent
}

];
