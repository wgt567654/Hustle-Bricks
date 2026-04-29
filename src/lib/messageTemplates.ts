export type MessageType = "post_quote" | "confirmation" | "reminder";

export const SERVICE_TYPES = [
  "House Cleaning",
  "Landscaping",
  "Lawn Care",
  "Pressure Washing",
  "Painting",
  "Handyman",
  "Moving",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Roofing",
  "Pest Control",
  "Pool Service",
  "Snow Removal",
  "Junk Removal",
  "Window Cleaning",
  "Gutter Cleaning",
  "Solar Panel Cleaning",
  "Carpentry",
  "Flooring",
  "Tree Service",
  "Catering",
  "Photography",
  "Event Planning",
  "Personal Training",
  "Tutoring",
  "Pet Grooming",
  "Auto Detailing",
  "Carpet Cleaning",
  "Appliance Repair",
  "Drywall / Patching",
  "Fence Installation & Repair",
  "Deck Building / Staining",
  "Concrete & Masonry",
  "Irrigation / Sprinkler Systems",
  "Chimney Sweep",
  "Air Duct Cleaning",
  "Garage Door Repair",
  "Locksmith",
  "Organizing / Decluttering",
  "Upholstery & Furniture Cleaning",
  "Other",
] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

type Templates = Record<ServiceType, Record<MessageType, string>>;

export const DEFAULT_TEMPLATES: Templates = {
  "House Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your home cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're looking forward to getting your home sparkling clean!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your home cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to taking care of things for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Landscaping": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your landscaping project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to transform your outdoor space!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your landscaping appointment is tomorrow on {date} at {time}. We're looking forward to getting your yard in great shape!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Lawn Care": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your lawn care scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll have your lawn looking its best!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your lawn care service is scheduled for tomorrow on {date} at {time}. We're looking forward to taking care of your yard!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Pressure Washing": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your pressure washing scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're looking forward to giving your surfaces a deep clean!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your pressure washing service is scheduled for tomorrow on {date} at {time}. We're looking forward to making things look brand new!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Painting": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your painting project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to freshen up your space!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your painting appointment is tomorrow on {date} at {time}. We're looking forward to transforming your space!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Handyman": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get everything taken care of for you!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your handyman service is scheduled for tomorrow on {date} at {time}. We're looking forward to checking those items off your list!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Moving": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your move scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make your move as smooth as possible!\n\nIf anything comes up or you have any questions before your move day, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your move is scheduled for tomorrow on {date} at {time}. We're ready to help make it a great experience!\n\nIf you need to make any changes or have any questions before tomorrow, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Plumbing": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your plumbing service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get everything flowing properly for you!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your plumbing appointment is tomorrow on {date} at {time}. We're looking forward to getting everything sorted out for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Electrical": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your electrical work scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make sure everything is wired up right!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your electrical appointment is tomorrow on {date} at {time}. We're looking forward to taking care of this for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "HVAC": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your HVAC service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make sure your system is running at its best!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your HVAC appointment is tomorrow on {date} at {time}. We're looking forward to keeping you comfortable!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Roofing": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your roofing project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make sure your home is protected from top to bottom!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your roofing appointment is tomorrow on {date} at {time}. We're ready to get started on your roof!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Pest Control": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your pest control service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll take care of the problem so you don't have to!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your pest control service is scheduled for tomorrow on {date} at {time}. We're looking forward to giving you peace of mind!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Pool Service": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your pool service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll have your pool looking crystal clear!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your pool service is scheduled for tomorrow on {date} at {time}. We're looking forward to getting your pool in perfect shape!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Snow Removal": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your snow removal scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make sure your property is clear and safe!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your snow removal is scheduled for tomorrow on {date} at {time}. We'll make sure you're all cleared out!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Junk Removal": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your junk removal scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll haul everything away and free up your space!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your junk removal is scheduled for tomorrow on {date} at {time}. We're ready to clear things out for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Window Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your window cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll have your windows sparkling and streak-free!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your window cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to brightening up your view!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Gutter Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your gutter cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your gutters clear and flowing properly!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your gutter cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to protecting your home!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Solar Panel Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your solar panel cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your panels cleaned up and running at full efficiency!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your solar panel cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to maximizing your system's output!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Carpentry": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your carpentry project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to bring your vision to life!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your carpentry appointment is tomorrow on {date} at {time}. We're looking forward to getting to work on your project!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Flooring": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your flooring project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to give your floors a beautiful new look!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your flooring appointment is tomorrow on {date} at {time}. We're looking forward to transforming your space!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Tree Service": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your tree service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll take care of your trees safely and efficiently!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your tree service is scheduled for tomorrow on {date} at {time}. We're looking forward to taking care of things for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Catering": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your catering scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to make your event delicious!\n\nIf anything comes up or you have any questions before your event, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your catering service is scheduled for tomorrow on {date} at {time}. We're looking forward to serving you!\n\nIf you need to make any changes or have any questions before your event, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Photography": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your photography session scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to capture some amazing shots!\n\nIf anything comes up or you have any questions before your session, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your photography session is tomorrow on {date} at {time}. We're looking forward to a great shoot!\n\nIf you need to make any changes or have any questions before your session, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Event Planning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your event planning underway. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to help make your event unforgettable!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your event planning consultation is tomorrow on {date} at {time}. We're looking forward to bringing your vision to life!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Personal Training": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your training sessions scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. Get ready to crush your goals!\n\nIf anything comes up or you have any questions before your session, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your training session is tomorrow on {date} at {time}. Come ready to work hard!\n\nIf you need to make any changes or have any questions before your session, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Tutoring": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your tutoring sessions scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to help you reach your learning goals!\n\nIf anything comes up or you have any questions before your session, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your tutoring session is tomorrow on {date} at {time}. Make sure to bring any materials you need!\n\nIf you need to make any changes or have any questions before your session, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Pet Grooming": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your pet's grooming scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got your pet's grooming officially scheduled for {date} at {time}. We'll have them looking and feeling their best!\n\nIf anything comes up or you have any questions before the appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your pet's grooming appointment is tomorrow on {date} at {time}. We're looking forward to pampering them!\n\nIf you need to make any changes or have any questions before the appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Auto Detailing": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your auto detailing scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll have your vehicle looking showroom-ready!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your auto detailing is scheduled for tomorrow on {date} at {time}. We're looking forward to making your ride shine!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Carpet Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your carpet cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll have your carpets fresh and looking like new!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your carpet cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to refreshing your carpets!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Appliance Repair": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your appliance repair scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your appliance back up and running!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your appliance repair is scheduled for tomorrow on {date} at {time}. We're looking forward to getting things fixed for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Drywall / Patching": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your drywall work scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll patch things up and leave it looking seamless!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your drywall appointment is tomorrow on {date} at {time}. We're looking forward to getting your walls looking perfect!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Fence Installation & Repair": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your fence project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your fence looking great and standing strong!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your fence appointment is tomorrow on {date} at {time}. We're looking forward to getting to work!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Deck Building / Staining": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your deck project scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to build you an outdoor space you'll love!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your deck appointment is tomorrow on {date} at {time}. We're looking forward to getting started!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Concrete & Masonry": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your concrete and masonry work scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll lay a solid foundation for you!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your concrete and masonry appointment is tomorrow on {date} at {time}. We're looking forward to getting the job done right!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Irrigation / Sprinkler Systems": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your irrigation service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your system running efficiently and keeping everything green!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your irrigation appointment is tomorrow on {date} at {time}. We're looking forward to keeping your yard healthy!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Chimney Sweep": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your chimney sweep scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make sure your chimney is clean and safe to use!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your chimney sweep is scheduled for tomorrow on {date} at {time}. We're looking forward to keeping your fireplace safe and ready to use!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Air Duct Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your air duct cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your ducts clean so you can breathe easy!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your air duct cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to improving your air quality!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Garage Door Repair": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your garage door repair scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll get your garage door working like new!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your garage door repair is scheduled for tomorrow on {date} at {time}. We're looking forward to getting things fixed for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Locksmith": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your locksmith service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll make sure your property is safe and secure!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your locksmith appointment is tomorrow on {date} at {time}. We're looking forward to keeping your property secure!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Organizing / Decluttering": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your organizing session scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're excited to help you create a space you love!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your organizing appointment is tomorrow on {date} at {time}. We're looking forward to helping you get everything in order!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Upholstery & Furniture Cleaning": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your upholstery cleaning scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We'll have your furniture looking and feeling fresh!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that your upholstery cleaning is scheduled for tomorrow on {date} at {time}. We're looking forward to refreshing your furniture!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
  "Other": {
    post_quote:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote with us! We're looking forward to getting your service scheduled. Please let us know which of the available time slots works best for you, or feel free to suggest a time that fits your schedule.\n\nLet me know if you have any questions—I'm happy to help!",
    confirmation:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nThanks again for confirming your quote—we've got you officially scheduled for {date} at {time}. We're looking forward to taking care of this for you!\n\nIf anything comes up or you have any questions before your appointment, feel free to reach out. Otherwise, we'll see you soon.",
    reminder:
      "Hi {clientName}, this is {ownerName} from {bizName}.\n\nJust a quick reminder that you're scheduled for service tomorrow on {date} at {time}. We're looking forward to taking care of this for you!\n\nIf you need to make any changes or have any questions before your appointment, feel free to reach out. Otherwise, we'll see you tomorrow.",
  },
};

export function interpolateTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function getDefaultTemplate(serviceType: string, messageType: MessageType): string {
  const templates = DEFAULT_TEMPLATES[serviceType as ServiceType] ?? DEFAULT_TEMPLATES["Other"];
  return templates[messageType];
}
