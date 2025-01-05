import * as schedule from 'node-schedule';


const globalScheduleInstance = () => {
    return schedule
}

declare const globalThis: {
    globalSchedule: ReturnType<typeof globalScheduleInstance>;
} & typeof global;

const scheduleInstance = globalThis.globalSchedule ?? globalScheduleInstance()

if (process.env.NODE_ENV !== 'production') globalThis.globalSchedule = scheduleInstance


class ScheduleService {

    schedule = globalThis.globalSchedule;

    scheduleJob(jobName: string, cronExpression: string, callback: schedule.JobCallback) {
        const job = new this.schedule.Job(jobName, callback);
        job.schedule(cronExpression);
        console.log(`[${ScheduleService.name}] Job scheduled with cron ${cronExpression}`);
    }

    cancelJob(jobName: string) {
        const job = this.schedule.scheduledJobs[jobName];
        if (job) {
            job.cancel();
            console.log(`[${ScheduleService.name}] Job ${jobName} cancelled`);
        }
    }

    getAlJobs() {
        return Object.keys(this.schedule.scheduledJobs);
    }

    printScheduledJobs() {
        console.log(`[${ScheduleService.name}] Scheduled jobs: \n- ${Object.keys(this.schedule.scheduledJobs).join('\n- ')}`);
    }
}

const scheduleService = new ScheduleService();
export default scheduleService;
