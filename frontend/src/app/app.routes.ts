import { Routes } from '@angular/router';

import { Login } from './pages/login/login';

import { AdminLayout } from './pages/admin/admin-layout/admin-layout';
import { Dashboard } from './pages/admin/dashboard/dashboard';
import { Users } from './pages/admin/users/users';
import { Faculty } from './pages/admin/faculty/faculty';
import { SubjectManagement } from './pages/admin/subject-management/subject-management';
import { Rooms } from './pages/admin/rooms/rooms';
import { BatchManagement } from './pages/admin/batch-management/batch-management';
import { Uploads } from './pages/admin/uploads/uploads';
import { Timetables } from './pages/admin/timetables/timetables';
import { AcademicSessionManagement } from './pages/admin/academic-session-management/academic-session-management';
import { LunchConfiguration } from './pages/admin/lunch-configuration/lunch-configuration';
import { QueryRetrievalComponent } from './pages/query-retrieval/query-retrieval';
import { TeacherDashboard } from './pages/faculty/teacher-dashboard/teacher-dashboard';
import { Timetable } from './pages/faculty/timetable/timetable';
import { ProgramManagement } from './pages/admin/program-management/program-management';
import { DepartmentManagement } from './pages/admin/department-management/department-management';

export const routes: Routes = [

  // ============================
  // LOGIN
  // ============================

  {
    path: 'login',
    component: Login
  },


  // ============================
  // DEFAULT
  // ============================

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },


  // ============================
  // ADMIN
  // ============================

  {
    path: 'admin',
    component: AdminLayout,

    children: [

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

      {
        path: 'dashboard',
        component: Dashboard
      },

      {
        path: 'users',
        component: Users
      },

      {
        path: 'faculty',
        component: Faculty
      },

      {
        path: 'programs',
        component: ProgramManagement
      },

      {
        path: 'departments',
        component: DepartmentManagement
      },

      {
        path: 'subjects',
        component: SubjectManagement
      },

      {
        path: 'rooms',
        component: Rooms
      },

      {
        path: 'batch-management',
        component: BatchManagement
      },

      {
        path: 'uploads',
        component: Uploads
      },

      {
        path: 'timetables',
        component: Timetables
      },

      {
        path: 'lock-lunch',
        component: LunchConfiguration
      },

      {
        path: 'academic-sessions',
        component: AcademicSessionManagement
      },

      {
        path: 'query-retrieval',
        component: QueryRetrievalComponent
      }

    ]
  },


  // ============================
  // TEACHER
  // ============================

  {
    path: 'teacher/dashboard',
    component: TeacherDashboard
  },

  {
    path: 'teacher/timetable',
    component: Timetable
  }

];