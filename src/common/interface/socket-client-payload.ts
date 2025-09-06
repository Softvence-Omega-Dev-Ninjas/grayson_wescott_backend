export type PayloadForSocketClient = {
  sub: string;
  email: string;
  emailToggle: boolean;
  userUpdates: boolean;
  communication: boolean;
  surveyAndPoll: boolean;
  tasksAndProjects: boolean;
  scheduling: boolean;
  message: boolean;
  userRegistration: boolean;
};
