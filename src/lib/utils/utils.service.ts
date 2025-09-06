import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Shift } from '@prisma/client';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UtilsService {
  private readonly saltRounds = 10;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  sanitizedResponse(sto: any, data: any) {
    return plainToInstance(sto, data, { excludeExtraneousValues: true });
  }

  removeDuplicateIds(ids: string[]) {
    return Array.from(new Set(ids));
  }

  // * AUTH UTILS
  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.saltRounds);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  generateToken(payload: JWTPayload): string {
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>(ENVEnum.JWT_SECRET),
      expiresIn: this.configService.get<string>(ENVEnum.JWT_EXPIRES_IN),
    });

    return token;
  }

  generateOtpAndExpiry(): { otp: number; expiryTime: Date } {
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit code
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);
    return { otp, expiryTime };
  }

  // * DB UTILS
  async ensureTeamExists(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!team) throw new AppError(404, 'Team not found');
    return team;
  }

  async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  }

  async ensureUsersExists(userIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });
    if (users.length !== userIds.length)
      throw new AppError(404, 'User not found');
    return users;
  }

  async ensureProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new AppError(404, 'Project not found');
    return project;
  }

  async ensureTaskExists(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        taskComments: {
          include: {
            commentar: {
              include: {
                profile: true,
              },
            },
          },
          // select:{
          //   comment:true,
          //   commentar:true,
          // },
          // include:{
          //   commentar:{
          //     include:{
          //       profile:{
          //         select:{
          //           profileUrl:true,
          //           firstName:true,
          //           lastName:true,
          //         }
          //       }
          //     },
          //   }
          // }
        },
      },
    });
    if (!task) throw new AppError(404, 'Task not found');
    return task;
  }

  async ensureMemberExistsInTeam(teamId: string, userId: string) {
    const member = await this.prisma.teamMembers.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new AppError(404, 'Member not found');
    return member;
  }

  async ensureQuestionExists(questionId: string) {
    const question = await this.prisma.surveyQuestions.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new AppError(404, 'Question not found');
    return question;
  }

  async ensureSurveyExists(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
    });
    if (!survey) throw new AppError(404, 'Survey not found');
    return survey;
  }

  async ensureTeamsExists(teamIds: string[]) {
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds } },
    });
    if (teams.length !== teamIds.length)
      throw new AppError(404, 'Team not found');
    return teams;
  }

  async resolveRecipients(
    isForAllUsers: boolean,
    teamIds?: string[],
  ): Promise<{ id: string; email: string }[]> {
    if (isForAllUsers) {
      const users = await this.prisma.user.findMany({
        select: { id: true, email: true },
      });
      return users.map((u) => {
        return {
          id: u.id,
          email: u.email,
        };
      });
    }
    if (teamIds && teamIds.length) {
      const members = await this.prisma.teamMembers.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true },
      });
      const uniqueIds = this.removeDuplicateIds(members.map((m) => m.userId));
      const membersWithEmail = await this.prisma.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, email: true },
      });
      return membersWithEmail.map((u) => {
        return {
          id: u.id,
          email: u.email,
        };
      });
    }
    return [];
  }

  async getEmailById(id: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');
    return user.email;
  }

  async getShiftById(id: string): Promise<Shift> {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new AppError(404, 'Shift not found');
    return shift;
  }

  // * validate user is assign to the task
  async ensureTaskAssignToUser(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { tasksUsers: true },
    });
    if (!task) throw new AppError(404, 'Task not found');

    const taskUser = task.tasksUsers.find((tu) => tu.userId === userId);
    if (!taskUser) throw new AppError(404, 'You are not assign to this task');
    return task;
  }

  // * validate user is in the project in which the task belongs
  async ensureUserInProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { projectUsers: true },
    });
    if (!project) throw new AppError(404, 'Project not found');

    const projectUser = project.projectUsers.find((pu) => pu.userId === userId);
    if (!projectUser) throw new AppError(404, 'You are not in this project');
    return project;
  }
}
