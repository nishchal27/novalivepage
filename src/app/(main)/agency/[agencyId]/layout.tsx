import BlurPage from '@/components/global/blur-page'
import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import {
  getNotificationAndUser,
  verifyAndAcceptInvitation,
} from '@/lib/queries'
import { currentUser } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  children: React.ReactNode
  params: { agencyId: string }
}

const layout = async ({ children, params }: Props) => {
  /*generally 'layout.tsx' doesn't refresh on every render but if 'params' is present it should rerender
  but if this doesn't work then the solution to this problem is, applying check for each page element or components*/   
  const agencyId = await verifyAndAcceptInvitation()
  const user = await currentUser()

  if (!user) {
    return redirect('/')
  }

  if (!agencyId) {
    return redirect('/agency')
  }

  if (
    user.privateMetadata.role !== 'AGENCY_OWNER' &&
    user.privateMetadata.role !== 'AGENCY_ADMIN'
  )
    return <Unauthorized />

  let allNoti: any = []
  const notifications = await getNotificationAndUser(agencyId)
  if (notifications) allNoti = notifications

 

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={params.agencyId}
        type="agency"
      />
      <div className="md:pl-[300px]">
        <InfoBar
          notifications={allNoti}
          role={allNoti.User?.role}
        />
        <div className="relative">
          <BlurPage>{children}</BlurPage>
        </div>
      </div>
    </div>
  )
}

export default layout
