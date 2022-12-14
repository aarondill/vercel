/* eslint-disable @typescript-eslint/naming-convention */
// 👆 because vercel API requires snake_case keys
import { Api } from "../utils/Api";
import { VercelEnvironmentInformation, VercelResponse } from "./models";
import { TokenManager } from "./TokenManager";

export class VercelManager {
	public onDidEnvironmentsUpdated: () => void = () => {};
	public onDidLogOut: () => void = () => {};
	public onDidDeploymentsUpdated: () => void = () => {};

	public onDidProjectSelected: () => void = () => {};

	private projectInfo: VercelResponse.info.project | null = null;
	private userInfo: VercelResponse.info.user | null = null;

	public constructor(private readonly token: TokenManager) {
		setInterval(() => {
			this.onDidDeploymentsUpdated();
			this.onDidEnvironmentsUpdated();
		}, 5 * 60 * 1000); // refresh every 5 mins
		//retains this value of vercel
		token.onProjectStateChanged = (id?: string) => {
			this.onDidDeploymentsUpdated();
			this.onDidEnvironmentsUpdated();
			// force refresh of info on next call.
			this.projectInfo = null;
			this.userInfo = null;
		};
	}
	async getProjectInfo(refresh: boolean = false) {
		if (this.projectInfo !== null && !refresh) return this.projectInfo;
		const response = await Api.projectInfo(
			{
				projectId: this.selectedProject,
			},
			this.authHeader
		);
		const result = (await response.json()) as VercelResponse.info.project;
		this.projectInfo = result;
		return result;
	}

	async getUserInfo(refresh: boolean = false) {
		if (this.userInfo !== null && !refresh) return this.userInfo;
		const response = await Api.userInfo({}, this.authHeader);
		const json = (await response.json()) as { user: VercelResponse.info.user };
		const result = json.user;
		this.userInfo = result;
		return result;
	}

	async logIn(apiToken: string): Promise<void> {
		await this.token.setAuth(apiToken);
		this.onDidDeploymentsUpdated();
		this.onDidEnvironmentsUpdated();
		console.log("login");
		this.token.onDidLogIn();
	}

	/**
	 * Unsets authtication and project and calls didLogOut, didDeploymentsUpdated, and didEnvironmentsUpdates;
	 */
	async logOut() {
		await this.token.setAuth(undefined);
		await this.token.setProject(undefined);
		this.onDidLogOut();
		this.token.onDidLogOut();
		this.onDidDeploymentsUpdated();
		this.onDidEnvironmentsUpdated();
	}

	/**
	 * @returns A list of deployments for the currently selected project and user or empty list if either doesn't exist
	 */
	async getDeployments() {
		if (this.auth && this.selectedProject) {
			const response = await Api.deployments(
				{
					projectId: this.selectedProject,
					limit: 50, //TODO create setting for this limit
				},
				this.authHeader
			);
			const data = (await response.json()) as VercelResponse.deployment;
			return data.deployments;
		} else {
			return [];
		}
	}
	/**
	 * @returns an array of environment variables for the current project from vercel,
	 * or undefined if no project is selected or no user is authenticated
	 */
	async getEnvironment(): Promise<VercelEnvironmentInformation[] | undefined> {
		if (this.auth && this.selectedProject) {
			const response = await Api.environment.getAll(
				{
					projectId: this.selectedProject,
				},
				this.authHeader
			);
			const data = (await response.json()) as VercelResponse.environment.getAll;
			if ("envs" in data) return data.envs;
			else return [data];
		} else {
			return undefined;
		}
	}
	/** Utility getter to return project id */
	get selectedProject() {
		return this.token.getProject();
	}
	/** Utility getter to return authentication token */
	get auth() {
		return this.token.getAuth();
	}
	/** Utility getter to return the proper fetch options for authentication  */
	private get authHeader() {
		return { headers: { Authorization: `Bearer ${this.auth}` } };
	}
}
