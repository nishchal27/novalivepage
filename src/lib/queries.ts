"use server"

import { clerkClient, currentUser } from "@clerk/nextjs"
import { db } from "./db"
import { redirect } from "next/navigation"
import { Agency, Lane, Plan, Prisma, Role, SubAccount, Tag, Ticket, User } from "@prisma/client"
import { v4 } from "uuid"
import { CreateFunnelFormSchema, CreateMediaType } from "./types"
import { z } from "zod"

export const getAuthUserDetails = async () => {
    const user = await currentUser()
    if (!user) {
        return
    }

    const userData = await db.user.findUnique({
        where: { email: user.emailAddresses[0].emailAddress, },
        include: {
            Agency: {
                include: {
                    SidebarOption: true,
                    SubAccount: {
                        include: {
                            SidebarOption: true
                        },
                    },
                },
            },
            Permissions: true,
        },
    })

    return userData
}

/**
 * Saves an activity log notification for a user, agency, and optionally a subaccount.
 * If agencyId is not provided, it is inferred from the subaccountId.
 * @param {Object} params - Parameters for saving activity log notification.
 * @param {string} params.agencyId - The ID of the agency (optional if subaccountId is provided).
 * @param {string} params.description - The description of the activity log.
 * @param {string} params.subaccountId - The ID of the subaccount (optional).
 * @returns {Promise<void>} - A promise that resolves when the notification is saved.
 */
export const saveActivityLogsNotification = async ({
    agencyId,
    description,
    subaccountId,
}: {
    agencyId?: string,
    description: string,
    subaccountId?: string
}) => {
    // Retrieve current authenticated user
    const authUser = await currentUser()
    let userData;

    // If there is no authenticated user, find user data based on subaccountId
    if (!authUser) {
        const response = await db.user.findFirst({
            where: {
                Agency: {
                    SubAccount: { some: { id: subaccountId } },
                }
            }
        })
        if (response) {
            userData = response
        }
    } else {
        // If there is an authenticated user, find user data based on email
        userData = await db.user.findUnique({
            where: { email: authUser?.emailAddresses[0].emailAddress },
        })
    }

    // If no user data found, log an error and return
    if (!userData) {
        console.log("Could not find a user")
        return
    }

    let foundAgencyId = agencyId

    // If agencyId is not provided, attempt to find it from subaccountId
    if (!foundAgencyId) {
        if (!subaccountId) {
            throw new Error('you need to provide an agency Id or subaccount Id')
        }
        const response = await db.subAccount.findUnique({
            where: { id: subaccountId },
        })
        if (response) foundAgencyId = response.agencyId
    }

    // Create notification based on whether subaccountId is provided or not
    if (subaccountId) {
        await db.notification.create({
            data: {
                notification: `${userData.name} | ${description}`,
                User: {
                    connect: {
                        id: userData.id,
                    },
                },
                Agency: {
                    connect: {
                        id: foundAgencyId,
                    },
                },
                SubAccount: {
                    connect: { id: subaccountId },
                },
            },
        })
    }
    else {
        await db.notification.create({
            data: {
                notification: `${userData.name} | ${description}`,
                User: {
                    connect: {
                        id: userData.id,
                    },
                },
                Agency: {
                    connect: {
                        id: foundAgencyId,
                    },
                },
            }
        })
    }
}

export const createTeamUser = async (agencyId: string, user: User) => {
    if (user.role === 'AGENCY_OWNER') return null
    const response = await db.user.create({ data: { ...user } })
    return response
}

export const verifyAndAcceptInvitation = async () => {
    const user = await currentUser()
    if (!user) return redirect('/sign-in')
    const invitationExists = await db.invitation.findUnique({
        where: {
            email: user.emailAddresses[0].emailAddress,
            status: "PENDING"
        },
    })

    if (invitationExists) {
        const userDetails = await createTeamUser(invitationExists.agencyId, {
            email: invitationExists.email,
            agencyId: invitationExists.agencyId,
            avatarUrl: user.imageUrl,
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            role: invitationExists.role,
            createdAt: new Date(),
            updatedAt: new Date()
        })
        await saveActivityLogsNotification({
            agencyId: invitationExists?.agencyId,
            description: `joined`,
            subaccountId: undefined,
        })

        if (userDetails) {
            await clerkClient.users.updateUserMetadata(user.id, {
                privateMetadata: {
                    role: userDetails.role || 'SUBACCOUNT_USER',
                },
            })

            await db.invitation.delete({
                where: { email: userDetails.email }
            })
            return userDetails.agencyId
        } else return null
    } else {
        const agency = await db.user.findUnique({
            where: {
                email: user.emailAddresses[0].emailAddress,
            },
        })
        return agency ? agency.agencyId : null
    }
}

export const updateAgencyDetails = async (
    agencyId: string,
    agencyDetails: Partial<Agency>
) => {
    const response = await db.agency.update({
        where: { id: agencyId },
        data: { ...agencyDetails },
    })
    return response
}


export const deleteAgency = async (agencyId: string) => {
    const response = await db.agency.delete({ where: { id: agencyId } })
    return response
}

//upsert: update data if it exists or create new data if it doesn't
// initializing user
export const initUser = async (newUser: Partial<User>) => {
    const user = await currentUser()
    if (!user) return

    const userData = await db.user.upsert({
        where: {
            email: user.emailAddresses[0].emailAddress,
        },
        update: newUser,
        create: {
            id: user.id,
            avatarUrl: user.imageUrl,
            email: user.emailAddresses[0].emailAddress,
            name: `${user.firstName} ${user.lastName}`,
            role: newUser.role || 'SUBACCOUNT_USER',
        },
    })

    await clerkClient.users.updateUserMetadata(user.id, {
        privateMetadata: {
            role: newUser.role || 'SUBACCOUNT_USER',
        },
    })

    return userData
}

export const upsertAgency = async (agency: Agency, price?: Plan) => {
    if (!agency.companyEmail) return null
    try {
        const agencyDetails = await db.agency.upsert({
            where: {
                id: agency.id,
            },
            update: agency,
            create: {
                users: {
                    connect: { email: agency.companyEmail },
                },
                ...agency,
                SidebarOption: {
                    create: [
                        {
                            name: 'Dashboard',
                            icon: 'category',
                            link: `/agency/${agency.id}`,
                        },
                        {
                            name: 'Launchpad',
                            icon: 'clipboardIcon',
                            link: `/agency/${agency.id}/launchpad`,
                        },
                        {
                            name: 'Billing',
                            icon: 'payment',
                            link: `/agency/${agency.id}/billing`,
                        },
                        {
                            name: 'Settings',
                            icon: 'settings',
                            link: `/agency/${agency.id}/settings`,
                        },
                        {
                            name: 'Sub Accounts',
                            icon: 'person',
                            link: `/agency/${agency.id}/all-subaccounts`,
                        },
                        {
                            name: 'Team',
                            icon: 'shield',
                            link: `/agency/${agency.id}/team`,
                        },
                    ],
                },
            },
        })
        return agencyDetails
    } catch (error) {
        console.log(error)
    }
}

export const getNotificationAndUser = async (agencyId: string) => {
    try {
        const response = await db.notification.findMany({
            where: { agencyId },
            include: { User: true },
            orderBy: {
                createdAt: 'desc',
            },
        })
        return response
    } catch (error) {
        console.log(error)
    }
}

/**
 * Upserts a subaccount with provided data.
 * If the subaccount's company email is not provided, returns null.
 * Creates a new subaccount if it does not exist; otherwise, updates the existing one.
 */
export const upsertSubAccount = async (subAccount: SubAccount) => {
    if (!subAccount.companyEmail) return null

    // Find agency owner based on agency ID and role
    const agencyOwner = await db.user.findFirst({
        where: {
            Agency: {
                id: subAccount.agencyId,
            },
            role: 'AGENCY_OWNER',
        },
    })
    if (!agencyOwner) return console.log('🔴Erorr could not create subaccount')
    const permissionId = v4()

    // Upsert subaccount with provided data
    const response = await db.subAccount.upsert({
        where: { id: subAccount.id },
        update: subAccount,
        create: {
            ...subAccount,
            Permissions: {
                create: {
                    access: true,
                    email: agencyOwner.email,
                    id: permissionId,
                },
                connect: {
                    subAccountId: subAccount.id,
                    id: permissionId,
                },
            },
            Pipeline: {
                create: { name: 'Lead Cycle' },
            },
            SidebarOption: {
                create: [
                    {
                        name: 'Launchpad',
                        icon: 'clipboardIcon',
                        link: `/subaccount/${subAccount.id}/launchpad`,
                    },
                    {
                        name: 'Settings',
                        icon: 'settings',
                        link: `/subaccount/${subAccount.id}/settings`,
                    },
                    {
                        name: 'Funnels',
                        icon: 'pipelines',
                        link: `/subaccount/${subAccount.id}/funnels`,
                    },
                    {
                        name: 'Media',
                        icon: 'database',
                        link: `/subaccount/${subAccount.id}/media`,
                    },
                    {
                        name: 'Automations',
                        icon: 'chip',
                        link: `/subaccount/${subAccount.id}/automations`,
                    },
                    {
                        name: 'Pipelines',
                        icon: 'flag',
                        link: `/subaccount/${subAccount.id}/pipelines`,
                    },
                    {
                        name: 'Contacts',
                        icon: 'person',
                        link: `/subaccount/${subAccount.id}/contacts`,
                    },
                    {
                        name: 'Dashboard',
                        icon: 'category',
                        link: `/subaccount/${subAccount.id}`,
                    },
                ],
            },
        },
    })
    return response
}

// Query the database to find the user's permissions
export const getUserPermissions = async (userId: string) => {
    const response = await db.user.findUnique({
        where: { id: userId }, //Query based on user ID
        select: { Permissions: { include: { SubAccount: true } } }, // Include permissions: all the subaccounts that the user has access to
    })

    // Return the retrieved permissions
    return response
}

/*
Returns a Promise resolving to the updated user object.
*/
export const updateUser = async (user: Partial<User>) => {
    // Update user information in the database
    const response = await db.user.update({
        where: { email: user.email },
        data: { ...user },
    })

    // Update user's private metadata using ClerkClient in clerk
    await clerkClient.users.updateUserMetadata(response.id, {
        privateMetadata: {
            role: user.role || 'SUBACCOUNT_USER',
        },
    })

    // Return the updated user object
    return response
}

//change permission: update or create new permission
export const changeUserPermissions = async (
    permissionId: string | undefined,
    userEmail: string,
    subAccountId: string,
    permission: boolean
) => {
    try {
        const response = await db.permissions.upsert({
            where: { id: permissionId },
            update: { access: permission },
            create: {
                access: permission,
                email: userEmail,
                subAccountId: subAccountId,
            },
        })
        return response
    } catch (error) {
        console.log('🔴Could not change persmission', error)
    }
}

export const getSubaccountDetails = async (subaccountId: string) => {
    const response = await db.subAccount.findUnique({
        where: {
            id: subaccountId,
        },
    })
    return response
}

export const deleteSubAccount = async (subaccountId: string) => {
    const response = await db.subAccount.delete({
        where: {
            id: subaccountId,
        },
    })
    return response
}

export const deleteUser = async (userId: string) => {
    await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
            role: undefined,
        },
    })
    const deletedUser = await db.user.delete({ where: { id: userId } })

    return deletedUser
}

export const getUser = async (id: string) => {
    const user = await db.user.findUnique({
        where: {
            id,
        },
    })

    return user
}


/*Sends an invitation to the specified email address for a given role within an agency. 
 * only one agency per email address
 * only one invitation per email address
 * operation: const invitations = await prisma.invitation.findMany()
 */
export const sendInvitation = async (
    role: Role,
    email: string,
    agencyId: string
) => {
    // Create an invitation record in the database, but only for unique email
    const resposne = await db.invitation.create({
        data: { email, agencyId, role },
    })

    try {
        // Send invitation email using a third-party service
        const invitation = await clerkClient.invitations.createInvitation({
            emailAddress: email,
            redirectUrl: process.env.NEXT_PUBLIC_URL,
            publicMetadata: {
                throughInvitation: true,
                role,
            },
        })
    } catch (error) {
        console.log(error)
        throw error
    }

    return resposne
}

export const getMedia = async (subaccountId: string) => {
    const mediafiles = await db.subAccount.findUnique({
        where: {
            id: subaccountId,
        },
        include: { Media: true },
    })
    return mediafiles
}

export const createMedia = async (
    subaccountId: string,
    mediaFile: CreateMediaType
) => {
    const response = await db.media.create({
        data: {
            link: mediaFile.link,
            name: mediaFile.name,
            subAccountId: subaccountId,
        },
    })

    return response
}

export const deleteMedia = async (mediaId: string) => {
    const response = await db.media.delete({
        where: {
            id: mediaId,
        },
    })
    return response
}

export const getPipelineDetails = async (pipelineId: string) => {
    const response = await db.pipeline.findUnique({
        where: {
            id: pipelineId,
        },
    })
    return response
}

export const getLanesWithTicketAndTags = async (pipelineId: string) => {
    const response = await db.lane.findMany({
        where: {
            pipelineId,
        },
        orderBy: { order: 'asc' },
        include: {
            Tickets: {
                orderBy: {
                    order: 'asc',
                },
                include: {
                    Tags: true,
                    Assigned: true,
                    Customer: true,
                },
            },
        },
    })
    return response
}

export const upsertFunnel = async (
    subaccountId: string,
    funnel: z.infer<typeof CreateFunnelFormSchema> & { liveProducts: string },
    funnelId: string
) => {
    const response = await db.funnel.upsert({
        where: { id: funnelId },
        update: funnel,
        create: {
            ...funnel,
            id: funnelId || v4(),
            subAccountId: subaccountId,
        },
    })

    return response
}

export const upsertPipeline = async (
    pipeline: Prisma.PipelineUncheckedCreateWithoutLaneInput
) => {
    const response = await db.pipeline.upsert({
        where: { id: pipeline.id || v4() },
        update: pipeline,
        create: pipeline,
    })

    return response
}

export const deletePipeline = async (pipelineId: string) => {
    const response = await db.pipeline.delete({
        where: { id: pipelineId },
    })
    return response
}

export const updateLanesOrder = async (lanes: Lane[]) => {
    try {
        const updateTrans = lanes.map((lane) =>
            db.lane.update({
                where: {
                    id: lane.id,
                },
                data: {
                    order: lane.order,
                },
            })
        )

        await db.$transaction(updateTrans)
        console.log('🟢 Done reordered 🟢')
    } catch (error) {
        console.log(error, 'ERROR UPDATE LANES ORDER')
    }
}

export const updateTicketsOrder = async (tickets: Ticket[]) => {
    try {
        const updateTrans = tickets.map((ticket) =>
            db.ticket.update({
                where: {
                    id: ticket.id,
                },
                data: {
                    order: ticket.order,
                    laneId: ticket.laneId,
                },
            })
        )

        await db.$transaction(updateTrans)
        console.log('🟢 Done reordered 🟢')
    } catch (error) {
        console.log(error, '🔴 ERROR UPDATE TICKET ORDER')
    }
}

export const upsertLane = async (lane: Prisma.LaneUncheckedCreateInput) => {
    let order: number

    if (!lane.order) {
        const lanes = await db.lane.findMany({
            where: {
                pipelineId: lane.pipelineId,
            },
        })

        order = lanes.length
    } else {
        order = lane.order
    }

    const response = await db.lane.upsert({
        where: { id: lane.id || v4() },
        update: lane,
        create: { ...lane, order },
    })

    return response
}

export const deleteLane = async (laneId: string) => {
    const resposne = await db.lane.delete({ where: { id: laneId } })
    return resposne
}

export const getTicketsWithTags = async (pipelineId: string) => {
    const response = await db.ticket.findMany({
        where: {
            Lane: {
                pipelineId,
            },
        },
        include: { Tags: true, Assigned: true, Customer: true },
    })
    return response
}

export const _getTicketsWithAllRelations = async (laneId: string) => {
    const response = await db.ticket.findMany({
        where: { laneId: laneId },
        include: {
            Assigned: true,
            Customer: true,
            Lane: true,
            Tags: true,
        },
    })
    return response
}

export const getSubAccountTeamMembers = async (subaccountId: string) => {
    const subaccountUsersWithAccess = await db.user.findMany({
        where: {
            Agency: {
                SubAccount: {
                    some: {
                        id: subaccountId,
                    },
                },
            },
            role: 'SUBACCOUNT_USER',
            Permissions: {
                some: {
                    subAccountId: subaccountId,
                    access: true,
                },
            },
        },
    })
    return subaccountUsersWithAccess
}

export const searchContacts = async (searchTerms: string) => {
    const response = await db.contact.findMany({
        where: {
            name: {
                contains: searchTerms,
            },
        },
    })
    return response
}

export const upsertTicket = async (
    ticket: Prisma.TicketUncheckedCreateInput,
    tags: Tag[]
) => {
    let order: number
    if (!ticket.order) {
        const tickets = await db.ticket.findMany({
            where: { laneId: ticket.laneId },
        })
        order = tickets.length
    } else {
        order = ticket.order
    }

    const response = await db.ticket.upsert({
        where: {
            id: ticket.id || v4(),
        },
        update: { ...ticket, Tags: { set: tags } },
        create: { ...ticket, Tags: { connect: tags }, order },
        include: {
            Assigned: true,
            Customer: true,
            Tags: true,
            Lane: true,
        },
    })

    return response
}

export const deleteTicket = async (ticketId: string) => {
    const response = await db.ticket.delete({
        where: {
            id: ticketId,
        },
    })

    return response
}

export const upsertTag = async (
    subaccountId: string,
    tag: Prisma.TagUncheckedCreateInput
) => {
    const response = await db.tag.upsert({
        where: { id: tag.id || v4(), subAccountId: subaccountId },
        update: tag,
        create: { ...tag, subAccountId: subaccountId },
    })

    return response
}

export const getTagsForSubaccount = async (subaccountId: string) => {
    const response = await db.subAccount.findUnique({
        where: { id: subaccountId },
        select: { Tags: true },
    })
    return response
}

export const deleteTag = async (tagId: string) => {
    const response = await db.tag.delete({ where: { id: tagId } })
    return response
}

export const upsertContact = async (
    contact: Prisma.ContactUncheckedCreateInput
) => {
    const response = await db.contact.upsert({
        where: { id: contact.id || v4() },
        update: contact,
        create: contact,
    })
    return response
}