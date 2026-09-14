import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/admin/dashboard/dashboard';
import { Users } from './pages/admin/users/users';
import { Faculty } from './pages/admin/faculty/faculty';
import { SubjectManagement } from './pages/admin/subject-management/subject-management';
import { Rooms } from './pages/admin/rooms/rooms';
import { Batches } from './pages/admin/batches/batches';
import { Uploads } from './pages/admin/uploads/uploads';
import { Timetables } from './pages/admin/timetables/timetables';
import { TeacherDashboard } from './pages/faculty/teacher-dashboard/teacher-dashboard';
import { Timetable } from './pages/faculty/timetable/timetable';
import { QueryRetrievalComponent } from './query-retrieval/query-retrieval';


export const routes: Routes = [


    {
    path: 'query-retrieval',
    component: QueryRetrievalComponent
  },
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
    path: 'admin/batches',
    component: Batches
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
  path: 'query-retrieval',
  component: QueryRetrievalComponent
}

];
